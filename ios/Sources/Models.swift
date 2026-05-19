// Models.swift — Structures de données partagées PCR Authenticator
// Compatible avec le protocole défini dans auth_iphone.rs

import Foundation
import CryptoKit

// MARK: - Identifiant d'appareil

struct DeviceIdentifier {
    static func current() -> String {
        // Sur iOS : UIDevice.identifierForVendor est stable tant que les apps du même dev sont installées
        let raw = (UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString)
            + "com.pcrmanager.ios"
        let hash = SHA256.hash(data: Data(raw.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Pairing

/// Payload de l'invitation scanné dans le QR code
/// URL : pcrauth://pair?v=1&host=...&port=...&id=...&nonce=...&mac_id=...
struct PairingInvitation {
    let host: String
    let port: UInt16
    let invitationID: UUID
    let nonce: Data         // 32 bytes
    let macDeviceID: String
    let version: Int

    static func from(url: URL) -> PairingInvitation? {
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.scheme == "pcrauth",
              comps.host == "pair",
              let params = comps.queryItems
        else { return nil }

        func param(_ key: String) -> String? {
            params.first(where: { $0.name == key })?.value
        }
        guard
            let host    = param("host"),
            let portStr = param("port"), let port = UInt16(portStr),
            let idStr   = param("id"),   let id   = UUID(uuidString: idStr),
            let nonceB64 = param("nonce"),
            let nonceData = Data(base64URLEncoded: nonceB64),
            let macID   = param("mac_id")
        else { return nil }

        let version = Int(param("v") ?? "1") ?? 1
        return PairingInvitation(
            host: host, port: port,
            invitationID: id, nonce: nonceData,
            macDeviceID: macID, version: version
        )
    }
}

/// Corps JSON envoyé au Mac lors de l'appairage (HTTP POST /pair)
struct PairingRequestBody: Encodable {
    let invitation_id: String
    let iphone_device_id: String
    let iphone_device_name: String
    /// P-256 uncompressed point, 65 bytes, base64url
    let iphone_identity_public_key: String
    /// DER ECDSA signature, base64url
    let signature: String
    let timestamp_ms: Int64
}

// MARK: - Auth challenge

/// Challenge scanné dans le QR code
/// URL : pcrauth://auth?v=1&host=...&port=...&challenge_id=...&nonce=...&mac_id=...&pairing_id=...&counter=...
struct AuthChallenge {
    let host: String
    let port: UInt16
    let challengeID: UUID
    let nonce: Data         // 32 bytes
    let macDeviceID: String
    let pairingID: UUID
    let expectedCounter: UInt64
    let version: Int

    static func from(url: URL) -> AuthChallenge? {
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.scheme == "pcrauth",
              comps.host == "auth",
              let params = comps.queryItems
        else { return nil }

        func param(_ key: String) -> String? {
            params.first(where: { $0.name == key })?.value
        }
        guard
            let host        = param("host"),
            let portStr     = param("port"),   let port    = UInt16(portStr),
            let cidStr      = param("challenge_id"), let cid = UUID(uuidString: cidStr),
            let nonceB64    = param("nonce"),
            let nonceData   = Data(base64URLEncoded: nonceB64),
            let macID       = param("mac_id"),
            let pidStr      = param("pairing_id"), let pid  = UUID(uuidString: pidStr),
            let ctrStr      = param("counter"),    let ctr  = UInt64(ctrStr)
        else { return nil }

        return AuthChallenge(
            host: host, port: port,
            challengeID: cid, nonce: nonceData,
            macDeviceID: macID, pairingID: pid,
            expectedCounter: ctr,
            version: Int(param("v") ?? "1") ?? 1
        )
    }
}

/// Corps JSON envoyé au Mac lors de l'auth (HTTP POST /auth)
struct AuthResponseBody: Encodable {
    let challenge_id: String
    let device_id: String
    /// DER ECDSA signature, base64url
    let signature: String
    let counter: UInt64
    let timestamp_ms: Int64
}

// MARK: - Pairing record (stocké localement sur iPhone)

struct PairingRecord: Codable {
    let pairingID: UUID
    let macDeviceID: String
    let macDeviceName: String
    let keychainTag: String    // tag pour retrouver la clé Secure Enclave
    let pairedAt: Date
    var authCounter: UInt64
    var lastAuthAt: Date?
}

// MARK: - Helpers Data

extension Data {
    init?(base64URLEncoded string: String) {
        var s = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        self.init(base64Encoded: s)
    }

    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
