// AuthManager.swift — Gestion du flux d'authentification iPhone → Mac
//
// Flux :
//   1. L'utilisateur scanne le QR code du Mac (challenge)
//   2. AuthManager parse le challenge
//   3. Face ID / Touch ID est demandé
//   4. La Secure Enclave signe le payload
//   5. La signature est POST au Mac via HTTP local
//   6. Le compteur local est incrémenté

import Foundation
import CryptoKit
import LocalAuthentication

enum AuthError: LocalizedError {
    case noPairingFound(UUID)
    case challengeExpired
    case biometryFailed(Error)
    case signingFailed(Error)
    case networkFailed(Error)
    case counterMismatch

    var errorDescription: String? {
        switch self {
        case .noPairingFound(let id): return "Aucun appairage trouvé pour \(id)"
        case .challengeExpired:       return "Challenge expiré. Réactualisez PCR Manager."
        case .biometryFailed(let e):  return "Authentification biométrique échouée: \(e.localizedDescription)"
        case .signingFailed(let e):   return "Signature impossible: \(e.localizedDescription)"
        case .networkFailed(let e):   return "Connexion au Mac impossible: \(e.localizedDescription)"
        case .counterMismatch:        return "Compteur invalide (possible replay)."
        }
    }
}

@MainActor
final class AuthManager: ObservableObject {

    @Published var pendingChallenge: AuthChallenge?
    @Published var isAuthenticating = false
    @Published var lastError: String?
    @Published var authSucceeded = false

    private let keyManager = SecureEnclaveKeyManager()
    private let storage    = PairingStorage()

    // MARK: - Réception du challenge

    func handleURL(_ url: URL) {
        guard let challenge = AuthChallenge.from(url: url) else { return }
        pendingChallenge = challenge
        lastError = nil
        authSucceeded = false
    }

    // MARK: - Authentification

    func authenticate() async {
        guard let challenge = pendingChallenge else { return }

        isAuthenticating = true
        lastError = nil

        do {
            // Récupérer l'enregistrement de pairing
            guard let record = storage.load(pairingID: challenge.pairingID) else {
                throw AuthError.noPairingFound(challenge.pairingID)
            }

            // Vérifier le compteur (anti-replay côté iPhone)
            if challenge.expectedCounter <= record.authCounter {
                throw AuthError.counterMismatch
            }

            // Demander Face ID / Touch ID
            let context = LAContext()
            context.localizedReason = "Connexion à PCR Manager sur votre Mac"
            context.localizedCancelTitle = "Annuler"

            do {
                try await context.evaluatePolicy(
                    .deviceOwnerAuthenticationWithBiometrics,
                    localizedReason: context.localizedReason
                )
            } catch {
                throw AuthError.biometryFailed(error)
            }

            // Charger la clé Secure Enclave (utilise le context déjà validé)
            let privateKey = try keyManager.loadKey(
                pairingID: challenge.pairingID,
                authenticationContext: context
            )

            // Construire le payload signé (même logique que build_auth_payload dans Rust)
            let timestampMs = Int64(Date().timeIntervalSince1970 * 1000)
            var payload = Data()
            withUnsafeBytes(of: challenge.challengeID.uuid) { payload.append(contentsOf: $0) }
            payload.append(challenge.nonce)
            withUnsafeBytes(of: timestampMs.bigEndian) { payload.append(contentsOf: $0) }
            payload.append(Data(challenge.macDeviceID.utf8))           // 64 chars hex
            withUnsafeBytes(of: challenge.expectedCounter.bigEndian) { payload.append(contentsOf: $0) }
            payload.append(Data("com.pcrmanager.ios".utf8))

            // Signer avec la Secure Enclave (hash SHA-256 interne)
            let signature: P256.Signing.ECDSASignature
            do {
                signature = try privateKey.signature(for: payload)
            } catch {
                throw AuthError.signingFailed(error)
            }

            let requestBody = AuthResponseBody(
                challenge_id: challenge.challengeID.uuidString,
                device_id: DeviceIdentifier.current(),
                signature: signature.derRepresentation.base64URLEncoded(),
                counter: challenge.expectedCounter,
                timestamp_ms: timestampMs
            )

            // Envoyer au Mac
            do {
                try await NetworkClient.post(
                    host: challenge.host,
                    port: challenge.port,
                    path: "/",
                    body: requestBody
                )
            } catch {
                throw AuthError.networkFailed(error)
            }

            // Mettre à jour le compteur local
            var updated = record
            updated.authCounter = challenge.expectedCounter
            updated.lastAuthAt = Date()
            storage.update(updated)

            pendingChallenge = nil
            authSucceeded = true

        } catch let error as AuthError {
            lastError = error.localizedDescription
        } catch {
            lastError = error.localizedDescription
        }

        isAuthenticating = false
    }

    func cancel() {
        pendingChallenge = nil
        lastError = nil
        authSucceeded = false
    }
}
