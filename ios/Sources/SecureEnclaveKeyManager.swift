// SecureEnclaveKeyManager.swift — Gestion des clés P-256 dans le Secure Enclave
//
// Chaque appairage possède sa propre clé dans le Secure Enclave.
// La clé n'est jamais exportable et requiert une validation biométrique pour signer.

import Foundation
import CryptoKit
import LocalAuthentication
import Security

final class SecureEnclaveKeyManager {

    // MARK: - Génération

    /// Crée une nouvelle clé P-256 dans le Secure Enclave pour un appairage donné.
    /// La clé est liée à la biométrie courante et n'est accessible que sur cet appareil.
    func generateKey(pairingID: UUID) throws -> SecureEnclave.P256.Signing.PrivateKey {
        var cfError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            [
                .privateKeyUsage,
                .biometryCurrentSet,  // invalide si de nouvelles empreintes/Face ID sont ajoutés
            ],
            &cfError
        ) else {
            throw cfError!.takeRetainedValue() as Error
        }

        let context = LAContext()
        let key = try SecureEnclave.P256.Signing.PrivateKey(
            accessControl: accessControl,
            authenticationContext: context
        )

        // Persiste la représentation opaque dans le Keychain
        try storeKeyData(key.dataRepresentation, tag: keychainTag(for: pairingID))
        return key
    }

    // MARK: - Chargement

    /// Charge la clé depuis le Secure Enclave.
    /// `context` doit avoir été évalué avec succès via `evaluatePolicy` avant l'appel.
    func loadKey(
        pairingID: UUID,
        authenticationContext: LAContext
    ) throws -> SecureEnclave.P256.Signing.PrivateKey {
        let data = try loadKeyData(tag: keychainTag(for: pairingID))
        return try SecureEnclave.P256.Signing.PrivateKey(
            dataRepresentation: data,
            authenticationContext: authenticationContext
        )
    }

    // MARK: - Suppression

    /// Supprime définitivement la clé (révocation, unpair).
    func deleteKey(pairingID: UUID) {
        let tag = keychainTag(for: pairingID)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: "com.pcrmanager.secureenclave",
            kSecAttrAccount: tag,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Clé publique

    /// Retourne la clé publique P-256 (65 bytes, format x963 non compressé).
    func publicKeyData(pairingID: UUID) throws -> Data {
        let data = try loadKeyData(tag: keychainTag(for: pairingID))
        // Reconstruire sans biométrie pour obtenir uniquement la clé publique
        // La clé publique est accessible sans authentification
        let key = try SecureEnclave.P256.Signing.PrivateKey(
            dataRepresentation: data
        )
        return key.publicKey.x963Representation
    }

    // MARK: - Keychain helpers

    private func keychainTag(for pairingID: UUID) -> String {
        "com.pcrmanager.secureenclave.\(pairingID.uuidString)"
    }

    private func storeKeyData(_ data: Data, tag: String) throws {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      "com.pcrmanager.secureenclave",
            kSecAttrAccount:      tag,
            kSecValueData:        data,
            kSecAttrAccessible:   kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable: false,
        ]
        SecItemDelete(query as CFDictionary) // supprimer si existant
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    private func loadKeyData(tag: String) throws -> Data {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      "com.pcrmanager.secureenclave",
            kSecAttrAccount:      tag,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: [NSLocalizedDescriptionKey: "Clé Secure Enclave introuvable (tag: \(tag))"]
            )
        }
        return data
    }
}
