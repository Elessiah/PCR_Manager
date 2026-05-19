// PairingManager.swift — Gestion du flux d'appairage iPhone ↔ Mac
//
// Flux :
//   1. L'utilisateur scanne le QR code du Mac
//   2. PairingManager parse l'invitation
//   3. L'utilisateur confirme sur l'écran iOS
//   4. On génère la clé d'identité dans le Secure Enclave
//   5. On signe l'invitation avec la clé fraîche
//   6. On POST au Mac via HTTP local
//   7. On stocke le PairingRecord dans le Keychain iOS

import Foundation
import CryptoKit
import LocalAuthentication
import UIKit

enum PairingError: LocalizedError {
    case invitationExpired
    case keyGenerationFailed(Error)
    case signingFailed(Error)
    case networkFailed(Error)
    case storageFailed(Error)

    var errorDescription: String? {
        switch self {
        case .invitationExpired:        return "L'invitation a expiré. Régénérez le QR code."
        case .keyGenerationFailed(let e): return "Génération de clé impossible: \(e.localizedDescription)"
        case .signingFailed(let e):     return "Signature impossible: \(e.localizedDescription)"
        case .networkFailed(let e):     return "Connexion au Mac impossible: \(e.localizedDescription)"
        case .storageFailed(let e):     return "Stockage du pairing impossible: \(e.localizedDescription)"
        }
    }
}

@MainActor
final class PairingManager: ObservableObject {

    @Published var pendingInvitation: PairingInvitation?
    @Published var isPairing = false
    @Published var lastError: String?
    @Published var paired = false

    private let keyManager = SecureEnclaveKeyManager()
    private let storage    = PairingStorage()

    // MARK: - Réception de l'invitation

    func handleURL(_ url: URL) {
        guard let invitation = PairingInvitation.from(url: url) else { return }

        // Vérifier que l'invitation n'est pas expirée (timestamp dans l'URL absent,
        // on valide simplement la cohérence des champs)
        pendingInvitation = invitation
        lastError = nil
    }

    // MARK: - Confirmation et complétion de l'appairage

    func confirmPairing() async {
        guard let invitation = pendingInvitation else { return }

        isPairing = true
        lastError = nil

        do {
            let pairingID = UUID()

            // 1. Évaluer la biométrie pour accéder au Secure Enclave
            let context = LAContext()
            context.localizedReason = "Appairер cet iPhone à PCR Manager sur votre Mac"
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: context.localizedReason
            )

            // 2. Générer la clé d'identité dans le Secure Enclave
            let identityKey: SecureEnclave.P256.Signing.PrivateKey
            do {
                identityKey = try keyManager.generateKey(pairingID: pairingID)
            } catch {
                throw PairingError.keyGenerationFailed(error)
            }

            // 3. Construire le payload signé : invitation_id_bytes || nonce
            var payload = Data()
            withUnsafeBytes(of: invitation.invitationID.uuid) { payload.append(contentsOf: $0) }
            payload.append(invitation.nonce)

            // 4. Signer avec la clé Secure Enclave (hash SHA-256 interne)
            let signature: P256.Signing.ECDSASignature
            do {
                signature = try identityKey.signature(for: payload)
            } catch {
                throw PairingError.signingFailed(error)
            }

            // 5. Encoder la clé publique (65 bytes x963 non compressé)
            let pubKeyB64 = identityKey.publicKey.x963Representation.base64URLEncoded()
            let sigB64    = signature.derRepresentation.base64URLEncoded()

            let requestBody = PairingRequestBody(
                invitation_id: invitation.invitationID.uuidString,
                iphone_device_id: DeviceIdentifier.current(),
                iphone_device_name: UIDevice.current.name,
                iphone_identity_public_key: pubKeyB64,
                signature: sigB64,
                timestamp_ms: Int64(Date().timeIntervalSince1970 * 1000)
            )

            // 6. Envoyer au Mac
            do {
                try await NetworkClient.post(
                    host: invitation.host,
                    port: invitation.port,
                    path: "/",
                    body: requestBody
                )
            } catch {
                // Nettoyer la clé générée si le réseau échoue
                keyManager.deleteKey(pairingID: pairingID)
                throw PairingError.networkFailed(error)
            }

            // 7. Stocker le PairingRecord localement
            let record = PairingRecord(
                pairingID: pairingID,
                macDeviceID: invitation.macDeviceID,
                macDeviceName: "Mac appairé",
                keychainTag: "com.pcrmanager.secureenclave.\(pairingID.uuidString)",
                pairedAt: Date(),
                authCounter: 0,
                lastAuthAt: nil
            )
            do {
                try storage.save(record)
            } catch {
                throw PairingError.storageFailed(error)
            }

            pendingInvitation = nil
            paired = true

        } catch let error as PairingError {
            lastError = error.localizedDescription
        } catch {
            lastError = error.localizedDescription
        }

        isPairing = false
    }

    func cancelPairing() {
        pendingInvitation = nil
        lastError = nil
    }

    // MARK: - Liste des appairages

    func loadedPairings() -> [PairingRecord] {
        storage.loadAll()
    }

    func revoke(pairingID: UUID) {
        keyManager.deleteKey(pairingID: pairingID)
        storage.delete(pairingID: pairingID)
    }
}

// MARK: - Stockage Keychain des PairingRecord

final class PairingStorage {

    private let service = "com.pcrmanager.pairings"

    func save(_ record: PairingRecord) throws {
        var index = loadIndex()
        index.append(record.pairingID)
        saveIndex(index)

        let data = try JSONEncoder().encode(record)
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      record.pairingID.uuidString,
            kSecValueData:        data,
            kSecAttrAccessible:   kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable: false,
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    func loadAll() -> [PairingRecord] {
        loadIndex().compactMap { load(pairingID: $0) }
    }

    func load(pairingID: UUID) -> PairingRecord? {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: pairingID.uuidString,
            kSecReturnData:  true,
            kSecMatchLimit:  kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return try? JSONDecoder().decode(PairingRecord.self, from: data)
    }

    func update(_ record: PairingRecord) {
        guard let data = try? JSONEncoder().encode(record) else { return }
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: record.pairingID.uuidString,
        ]
        SecItemUpdate(query as CFDictionary, [kSecValueData: data] as CFDictionary)
    }

    func delete(pairingID: UUID) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: pairingID.uuidString,
        ]
        SecItemDelete(query as CFDictionary)
        var index = loadIndex()
        index.removeAll { $0 == pairingID }
        saveIndex(index)
    }

    private func loadIndex() -> [UUID] {
        guard let data = UserDefaults.standard.data(forKey: "\(service).index"),
              let ids = try? JSONDecoder().decode([UUID].self, from: data)
        else { return [] }
        return ids
    }

    private func saveIndex(_ ids: [UUID]) {
        if let data = try? JSONEncoder().encode(ids) {
            UserDefaults.standard.set(data, forKey: "\(service).index")
        }
    }
}
