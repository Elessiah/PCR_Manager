# Architecture : Authentification Passwordless Offline-First — Mac + iPhone

> **Version** : 1.0 — Mai 2026  
> **Statut** : Document de référence d'implémentation  
> **Portée** : macOS (Tauri + Swift helpers) × iOS (SwiftUI native)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Choix technologiques](#2-choix-technologiques)
3. [Modèles cryptographiques](#3-modèles-cryptographiques)
4. [Structures de données](#4-structures-de-données)
5. [Flow d'appairage détaillé](#5-flow-dappairage-détaillé)
6. [Flow d'authentification détaillé](#6-flow-dauthentification-détaillé)
7. [Mécanismes anti-rejeu](#7-mécanismes-anti-rejeu)
8. [Mécanismes anti-MITM](#8-mécanismes-anti-mitm)
9. [Secure Enclave — Bonnes pratiques](#9-secure-enclave--bonnes-pratiques)
10. [Couche de communication](#10-couche-de-communication)
11. [Intégration Tauri (Mac)](#11-intégration-tauri-mac)
12. [Pseudo-code Swift complet](#12-pseudo-code-swift-complet)
13. [Recommandations UX](#13-recommandations-ux)
14. [Risques de sécurité](#14-risques-de-sécurité)
15. [Limites techniques](#15-limites-techniques)
16. [Alternatives](#16-alternatives)
17. [Schémas de communication](#17-schémas-de-communication)

---

## 1. Vue d'ensemble

### Principe fondamental

```
┌─────────────────────────────────────────────────────────────────┐
│  MODÈLE DE CONFIANCE                                            │
│                                                                 │
│  iPhone (Secure Enclave)          Mac (Tauri App)               │
│  ┌─────────────────────┐          ┌─────────────────────┐       │
│  │  Clé PRIVÉE P-256   │          │  Clé PUBLIQUE P-256  │      │
│  │  ─────────────────  │          │  ─────────────────── │      │
│  │  • Jamais exportée  │   BLE    │  • Stockée Keychain  │      │
│  │  • Biométrie req.   │ ◄──────► │  • Vérifie signature │      │
│  │  • Secure Enclave   │          │  • Génère challenges │      │
│  └─────────────────────┘          └─────────────────────┘       │
│                                                                 │
│  La clé privée ne QUITTE JAMAIS l'iPhone.                       │
│  Le Mac ne CONNAÎT JAMAIS le secret.                            │
└─────────────────────────────────────────────────────────────────┘
```

### Invariants de sécurité

| Invariant | Mécanisme |
|-----------|-----------|
| Aucun mot de passe | Cryptographie asymétrique pure |
| Clé privée confinée | Secure Enclave, attribut `privateKeyUsage` |
| Biométrie obligatoire | `SecAccessControlFlags.biometryCurrentSet` |
| Offline possible | Cryptographie locale, pas de PKI externe |
| Résistance replay | Nonce 32 bytes + timestamp + compteur |
| Résistance MITM | ECDH pairing + binding Device ID |
| Revocation | Suppression du pairing record côté Mac |

---

## 2. Choix technologiques

### Tableau de décision

| Composant | Choix retenu | Alternative | Raison |
|-----------|-------------|-------------|--------|
| Algorithme signature | **P-256 / ECDSA** | Ed25519 | Seul algo supporté par Secure Enclave iOS |
| Transport pairing | **MultipeerConnectivity** | CoreBluetooth raw | API haut niveau, gère BLE + WiFi Direct |
| Transport auth | **CoreBluetooth (GATT)** | MPC | Latence < 100ms, background capable |
| Biométrie iOS | **LocalAuthentication** | — | Framework Apple natif, Face ID + Touch ID |
| Crypto iOS | **CryptoKit + SecureEnclave** | CommonCrypto | Natif Swift, accès Secure Enclave |
| Crypto Mac | **CryptoKit (Rust via FFI)** | openssl | Cohérence avec iOS |
| Stockage clés Mac | **macOS Keychain** | fichier chiffré | Intégré OS, ACL native |
| Stockage pairing iOS | **Keychain (kSecAttrAccessibleWhenUnlocked)** | UserDefaults | Sécurisé, backup optionnel |
| QR Code | **CoreImage CIQRCodeGenerator** | librairie tierce | Natif, 0 dépendance |
| Deep link pairing | **URL Scheme custom** `pcrauth://pair?...` | Universal Link | Fonctionne offline |

### APIs Apple utilisées

**iOS (iPhone)**
```
CryptoKit                    → génération clés, ECDH, hash
LocalAuthentication          → Face ID / Touch ID
AuthenticationServices       → (optionnel) PassKey compat
Security (SecAccessControl)  → attributs Secure Enclave
MultipeerConnectivity        → transport pairing
CoreBluetooth                → transport auth BLE
AVFoundation                 → scan QR code
```

**macOS (Tauri App + Swift helper)**
```
CryptoKit                    → vérification signature P-256
Security (Keychain)          → stockage clé publique + pairing
MultipeerConnectivity        → transport pairing
CoreBluetooth                → GATT server, détection iPhone
CoreImage                    → génération QR code
```

---

## 3. Modèles cryptographiques

### 3.1 Types de clés

```
┌──────────────────────────────────────────────────────────────────────┐
│  TAXONOMIE DES CLÉS                                                   │
│                                                                       │
│  iPhone                                                               │
│  ├── [IDENTITY KEY] P-256 dans Secure Enclave (permanente)            │
│  │   Attribut: biometryCurrentSet + privateKeyUsage                   │
│  │   Stockage: Secure Enclave (jamais exportable)                     │
│  │   Usage: signer les challenges d'authentification                  │
│  │                                                                     │
│  └── [EPHEMERAL KEY] P-256 en mémoire (temporaire, pairing)          │
│      Usage: ECDH lors du pairing, détruite après                      │
│                                                                       │
│  macOS                                                                │
│  ├── [IDENTITY KEY] P-256 dans Keychain (permanente)                  │
│  │   Usage: signer les invitations de pairing                         │
│  │                                                                     │
│  ├── [PEER PUBLIC KEY] P-256 stockée Keychain (permanente)            │
│  │   = clé publique de l'iPhone                                        │
│  │   Usage: vérifier les signatures d'authentification                │
│  │                                                                     │
│  └── [EPHEMERAL KEY] P-256 en mémoire (temporaire, pairing)          │
│      Usage: ECDH lors du pairing, détruite après                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Primitives cryptographiques

```
Signature:      ECDSA-P256-SHA256
                └── supportée nativement par Secure Enclave
                └── taille signature: 64-72 bytes (DER variable)

ECDH pairing:   P256.KeyAgreement (CryptoKit)
                └── shared secret → HKDF-SHA256 → session key 32 bytes

Nonce:          SecRandomCopyBytes(32) — qualité cryptographique
                └── source: Secure Random iOS kernel

Hash:           SHA-256 (via CryptoKit)

KDF:            HKDF-SHA256
                salt = nonce_pairing (32 bytes)
                info = "PCRManager-Pairing-v1"
                output = 32 bytes → AES-256-GCM session key

Chiffrement transport: AES-256-GCM (iv 12 bytes, auth tag 16 bytes)
```

### 3.3 Structure du challenge signé

```
DONNÉES SIGNÉES (payload_to_sign):
┌────────────────────────────────────────┐
│ challenge_id    : UUID (16 bytes)      │
│ nonce           : [UInt8] (32 bytes)   │
│ timestamp       : Int64 (Unix ms)      │
│ mac_device_id   : String (hashed)      │
│ counter         : UInt64               │
│ app_bundle_id   : String               │
└────────────────────────────────────────┘

SÉRIALISATION pour signature:
payload = SHA256(challenge_id || nonce || timestamp_be || mac_device_id_sha256 || counter_be)

SIGNATURE:
signature = SecureEnclave.sign(payload, with: identityPrivateKey)
```

---

## 4. Structures de données

### 4.1 Swift — Structures partagées

```swift
// ─────────────────────────────────────────
// MODÈLES COMMUNS (partagés iOS/macOS via package Swift)
// ─────────────────────────────────────────

import Foundation
import CryptoKit

// Identifiant d'appareil — dérivé de l'identifiant hardware
struct DeviceIdentifier: Codable, Hashable {
    let value: String  // SHA256(UUID().uuidString + bundleID)
    
    static func current() -> DeviceIdentifier {
        // iOS: identifierForVendor
        // macOS: IOPlatformUUID via IOKit
        let raw = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let hash = SHA256.hash(data: Data(raw.utf8))
        return DeviceIdentifier(value: hash.compactMap { String(format: "%02x", $0) }.joined())
    }
}

// ─────────────────────────────────────────
// PAIRING
// ─────────────────────────────────────────

/// QR Code payload (Mac → iPhone via QR scan)
struct PairingInvitation: Codable {
    let invitationID: UUID                // UUID unique, usage unique
    let macDeviceID: DeviceIdentifier     // ID du Mac
    let macDeviceName: String             // "MacBook de Jean"
    let macEphemeralPublicKey: Data       // P-256 uncompressed point (65 bytes)
    let nonce: Data                       // 32 bytes random
    let timestamp: Date                   // heure génération
    let appBundleID: String               // "com.pcrmanager.app"
    let protocolVersion: Int              // 1
    
    // Encodé en URL:
    // pcrauth://pair?data=<base64url(json)>&sig=<base64url(mac_sig)>
}

/// Réponse iPhone lors du pairing (iPhone → Mac via MPC)
struct PairingResponse: Codable {
    let invitationID: UUID                // Echo de l'invitation
    let iphoneDeviceID: DeviceIdentifier
    let iphoneDeviceName: String          // "iPhone de Jean"
    let iphoneIdentityPublicKey: Data     // P-256 pub key (65 bytes), clé permanente
    let iphoneEphemeralPublicKey: Data    // P-256 pub key (65 bytes), ECDH
    let signature: Data                   // ECDSA sig du hash(invitation) avec identity key
    let timestamp: Date
}

/// Enregistrement de pairing — stocké de chaque côté
struct PairingRecord: Codable {
    let pairingID: UUID
    let pairedAt: Date
    var lastAuthAt: Date?
    var authCounter: UInt64               // compteur monotone, démarre à 0
    
    // Côté Mac: stocke la clé publique de l'iPhone
    let peerPublicKey: Data               // P-256 65 bytes
    let peerDeviceID: DeviceIdentifier
    let peerDeviceName: String
    
    // Côté iPhone: stocke la clé publique du Mac + tag Keychain
    // let macPublicKey: Data             // (optionnel, pour auth mutuelle)
    let keychainTag: String               // tag pour retrouver la clé Secure Enclave
}

// ─────────────────────────────────────────
// AUTHENTIFICATION
// ─────────────────────────────────────────

/// Challenge envoyé par le Mac → iPhone
struct AuthChallenge: Codable {
    let challengeID: UUID                 // usage unique, rejeté si déjà vu
    let nonce: Data                       // 32 bytes cryptographiquement aléatoires
    let timestamp: Date                   // pour validation fenêtre temporelle
    let macDeviceID: DeviceIdentifier     // binding à cet appareil Mac précis
    let pairingID: UUID                   // quel pairing utiliser
    let expectedCounter: UInt64           // compteur attendu (anti-replay)
    let appBundleID: String               // binding à l'application
}

/// Réponse signée de l'iPhone → Mac
struct AuthResponse: Codable {
    let challengeID: UUID                 // echo du challenge
    let deviceID: DeviceIdentifier        // qui répond
    let signature: Data                   // ECDSA signature du payload
    let counter: UInt64                   // compteur incrémenté
    let timestamp: Date                   // heure de réponse
}

/// Payload exact signé par la Secure Enclave
struct SignedPayload {
    // NE PAS stocker — calculé dynamiquement
    static func build(from challenge: AuthChallenge, counter: UInt64) -> Data {
        var data = Data()
        data.append(contentsOf: challenge.challengeID.uuidString.utf8)
        data.append(challenge.nonce)
        var ts = Int64(challenge.timestamp.timeIntervalSince1970 * 1000).bigEndian
        data.append(contentsOf: withUnsafeBytes(of: &ts) { Array($0) })
        data.append(contentsOf: challenge.macDeviceID.value.utf8)
        var ctr = counter.bigEndian
        data.append(contentsOf: withUnsafeBytes(of: &ctr) { Array($0) })
        data.append(contentsOf: challenge.appBundleID.utf8)
        // Hash final pour taille constante
        return Data(SHA256.hash(data: data))
    }
}
```

### 4.2 Stockage macOS (Keychain)

```swift
// Clés Keychain macOS
enum MacKeychainKey {
    static let macIdentityPrivateKey = "com.pcrmanager.mac.identity.private"
    static let macIdentityPublicKey  = "com.pcrmanager.mac.identity.public"
    static func peerPublicKey(pairingID: UUID) -> String {
        "com.pcrmanager.peer.pubkey.\(pairingID.uuidString)"
    }
    static func pairingRecord(pairingID: UUID) -> String {
        "com.pcrmanager.pairing.\(pairingID.uuidString)"
    }
}

// Index des pairings (stocké UserDefaults chiffré ou Keychain)
struct PairingIndex: Codable {
    var pairingIDs: [UUID]
    var activePairingID: UUID?
}
```

### 4.3 Stockage iOS (Keychain + Secure Enclave)

```swift
// Tags Keychain iOS
enum iOSKeychainTag {
    // Tag pour la clé Secure Enclave (privateKeyUsage)
    static func identityKeyTag(pairingID: UUID) -> Data {
        Data("com.pcrmanager.ios.identity.\(pairingID.uuidString)".utf8)
    }
    // Tag pour l'enregistrement de pairing
    static func pairingRecordKey(pairingID: UUID) -> String {
        "com.pcrmanager.ios.pairing.\(pairingID.uuidString)"
    }
}
```

---

## 5. Flow d'appairage détaillé

### 5.1 Diagramme de séquence

```
     macOS App                 iPhone App               Secure Enclave
         │                         │                         │
         │ 1. Génère keypair        │                         │
         │    éphémère (P-256)      │                         │
         │ 2. Génère nonce (32B)    │                         │
         │ 3. Encode PairingInvit.  │                         │
         │ 4. Signe avec Mac        │                         │
         │    identity key          │                         │
         │ 5. Affiche QR Code       │                         │
         │ ─────────────────────── QR Scan ──────────────────►│
         │                         │ 6. Parse invitation     │
         │                         │ 7. Vérifie timestamp    │
         │                         │    (< 5 min)            │
         │                         │ 8. Affiche Mac name,    │
         │                         │    demande confirmation │
         │                         │                         │
         │                         │ 9. User confirme ──────►│
         │                         │                         │ 10. Génère clé P-256
         │                         │                         │     dans Secure Enclave
         │                         │                         │     (biometryCurrentSet)
         │                         │◄────────────────────────│ 11. Retourne pub key
         │                         │                         │
         │                         │ 12. Génère keypair      │
         │                         │     éphémère (P-256)    │
         │                         │ 13. ECDH:               │
         │                         │     iphEph × macEph     │
         │                         │     → shared secret     │
         │                         │ 14. HKDF → session key  │
         │                         │ 15. Signe invitation    │
         │                         │     avec identity key   │
         │◄──── MPC/BLE ───────────│ 16. Envoie PairingResp  │
         │                         │     (chiffrée AES-GCM)  │
         │                         │                         │
         │ 17. ECDH:               │                         │
         │     macEph × iphEph     │                         │
         │     → shared secret     │                         │
         │ 18. HKDF → session key  │                         │
         │ 19. Déchiffre réponse   │                         │
         │ 20. Vérifie signature   │                         │
         │     iPhone avec la      │                         │
         │     clé pub reçue       │                         │
         │ 21. Stocke PairingRecord│                         │
         │     + peer pub key      │                         │
         │     dans Keychain       │                         │
         │──── MPC/BLE ───────────►│ 22. Confirmation pairing│
         │                         │ 23. Stocke PairingRecord│
         │                         │     dans Keychain iOS   │
         │                         │ 24. Lie pairing à la    │
         │                         │     clé Secure Enclave  │
```

### 5.2 Sécurité du QR code

Le QR code contient :
```
pcrauth://pair?v=1&d=<base64url(json(PairingInvitation))>&s=<base64url(mac_signature)>

Données signées par le Mac = SHA256(invitationID || nonce || timestamp || macDeviceID || appBundleID)
```

**Protections** :
- L'invitation expire après **5 minutes** (timestamp vérifié)
- L'`invitationID` est usage unique (stocké côté Mac jusqu'à complétion)
- La signature du Mac prouve que le QR vient bien de cette instance de l'app
- Le nonce empêche la réutilisation d'un QR intercepté

### 5.3 Sécurité du canal MPC lors du pairing

```
1. MPC découverte: iPhone annonce "PCRManager-Pairing" avec son peerID
2. Mac invite l'iPhone avec le même invitationID (vérification croisée)
3. Toutes les données transitent chiffrées via AES-256-GCM avec la session key ECDH
4. Après complétion, la session key éphémère est effacée des deux côtés
```

### 5.4 Validation côté Mac (étape 20)

```swift
func validatePairingResponse(_ response: PairingResponse, invitation: PairingInvitation) throws {
    // 1. Echo de l'invitationID
    guard response.invitationID == invitation.invitationID else {
        throw PairingError.invitationMismatch
    }
    
    // 2. Fenêtre temporelle (l'iPhone ne doit pas répondre 10 min après)
    let elapsed = Date().timeIntervalSince(response.timestamp)
    guard abs(elapsed) < 300 else {  // 5 minutes
        throw PairingError.responseExpired
    }
    
    // 3. Vérification signature iPhone
    let iphonePublicKey = try P256.Signing.PublicKey(x963Representation: response.iphoneIdentityPublicKey)
    let payloadToVerify = buildInvitationHash(invitation)
    let ecdsaSignature = try P256.Signing.ECDSASignature(derRepresentation: response.signature)
    guard iphonePublicKey.isValidSignature(ecdsaSignature, for: payloadToVerify) else {
        throw PairingError.invalidSignature
    }
    
    // 4. Vérifier que deviceID correspond à ce qui était annoncé en MPC
    guard response.iphoneDeviceID == expectedDeviceID else {
        throw PairingError.deviceMismatch
    }
}
```

---

## 6. Flow d'authentification détaillé

### 6.1 Diagramme de séquence

```
     macOS App                 iPhone App               Secure Enclave
         │                         │                         │
         │ ═══ DÉTECTION ═══════════════════════════════════ │
         │                         │                         │
         │ 1. BLE scan:            │                         │
         │    cherche service      │                         │
         │    "PCRManager-Auth"    │                         │
         │◄──── BLE Advertisement ─│ 2. iPhone advertise     │
         │                         │    son deviceID         │
         │                         │    (chiffré)            │
         │ 3. Reconnaît iPhone     │                         │
         │    appairé              │                         │
         │                         │                         │
         │ ═══ CHALLENGE ══════════════════════════════════ │
         │                         │                         │
         │ 4. Génère AuthChallenge │                         │
         │    nonce = random(32B)  │                         │
         │    counter = stored + 1 │                         │
         │    timestamp = now      │                         │
         │                         │                         │
         │───── BLE GATT Write ───►│ 5. Reçoit challenge     │
         │                         │    Vérifie:             │
         │                         │    - Mac device ID      │
         │                         │    - Timestamp (±30s)   │
         │                         │    - challengeID non vu │
         │                         │                         │
         │ ═══ BIOMÉTRIE ══════════════════════════════════ │
         │                         │                         │
         │                         │ 6. LAContext.           │
         │                         │    evaluatePolicy(      │
         │                         │    .biometryAny)        │
         │                         │    "Connexion à         │
         │                         │     PCR Manager"        │
         │                         │                         │
         │                         │ ═══ Face ID/Touch ID ══►│
         │                         │◄═══ Succès biométrie ══ │
         │                         │                         │
         │ ═══ SIGNATURE ══════════════════════════════════ │
         │                         │                         │
         │                         │ 7. Calcule payload      │
         │                         │    SHA256(challenge)    │
         │                         │──────────────────────── ►│ 8. Secure Enclave
         │                         │                          │    signe payload
         │                         │◄──────────────────────── │ 9. Retourne signature
         │                         │                         │
         │                         │ 10. Incrémente counter  │
         │                         │     Stocke challengeID  │
         │                         │     comme "vu"          │
         │                         │                         │
         │◄──── BLE GATT Read ─────│ 11. Envoie AuthResponse │
         │                         │                         │
         │ ═══ VÉRIFICATION ═══════════════════════════════ │
         │                         │                         │
         │ 12. Vérifie:            │                         │
         │     - challengeID echo  │                         │
         │     - timestamp (±30s)  │                         │
         │     - counter > stored  │                         │
         │     - signature ECDSA   │                         │
         │       avec peer pubkey  │                         │
         │                         │                         │
         │ 13. Met à jour counter  │                         │
         │     authCounter += 1    │                         │
         │     lastAuthAt = now    │                         │
         │                         │                         │
         │ 14. Session ouverte     │                         │
         │     ✓ ACCÈS ACCORDÉ     │                         │
```

### 6.2 Vérification côté Mac

```swift
func verifyAuthResponse(_ response: AuthResponse, challenge: AuthChallenge, pairingRecord: PairingRecord) throws {
    
    // ── 1. Echo challengeID ──
    guard response.challengeID == challenge.challengeID else {
        throw AuthError.challengeMismatch
    }
    
    // ── 2. Fenêtre temporelle (±30 secondes) ──
    let now = Date()
    let challengeAge = now.timeIntervalSince(challenge.timestamp)
    let responseAge  = now.timeIntervalSince(response.timestamp)
    guard challengeAge >= 0 && challengeAge < 30 else {
        throw AuthError.challengeExpired(age: challengeAge)
    }
    guard responseAge >= 0 && responseAge < 30 else {
        throw AuthError.responseTimestampInvalid
    }
    
    // ── 3. Compteur anti-replay ──
    guard response.counter > pairingRecord.authCounter else {
        throw AuthError.counterReplay(received: response.counter, stored: pairingRecord.authCounter)
    }
    
    // ── 4. Vérification signature ECDSA ──
    let peerPublicKey = try P256.Signing.PublicKey(x963Representation: pairingRecord.peerPublicKey)
    let payload = SignedPayload.build(from: challenge, counter: response.counter)
    let signature = try P256.Signing.ECDSASignature(derRepresentation: response.signature)
    
    guard peerPublicKey.isValidSignature(signature, for: payload) else {
        throw AuthError.signatureInvalid
    }
    
    // ── 5. Device ID binding ──
    guard response.deviceID == pairingRecord.peerDeviceID else {
        throw AuthError.deviceMismatch
    }
}
```

### 6.3 Durée cible

| Étape | Durée cible |
|-------|-------------|
| Détection BLE | 0–2 s (background) |
| Envoi challenge | < 50 ms |
| Prompt biométrie | 0.5–1.5 s (utilisateur) |
| Signature Secure Enclave | < 100 ms |
| Transmission réponse | < 50 ms |
| Vérification Mac | < 10 ms |
| **Total perçu** | **~2–3 s** |

---

## 7. Mécanismes anti-rejeu

### 7.1 Triple verrouillage

```
┌──────────────────────────────────────────────────────┐
│  COUCHE 1 : Nonce cryptographique                    │
│  • 32 bytes SecRandomCopyBytes()                     │
│  • Unique par challenge                              │
│  • Stocké côté Mac jusqu'à résolution               │
│  • Rejeté si déjà vu (Set<Data> en mémoire)         │
│                                                      │
│  COUCHE 2 : Fenêtre temporelle                       │
│  • Challenge valide ±30 secondes                    │
│  • Timestamp signé dans le payload                  │
│  • Horloge Mac = référence                          │
│                                                      │
│  COUCHE 3 : Compteur monotone                        │
│  • authCounter stocké persistant dans Keychain      │
│  • Incrémenté à chaque auth réussie                 │
│  • Response.counter DOIT être > stored              │
│  • Jamais décrémenté, jamais réinitialisé           │
└──────────────────────────────────────────────────────┘
```

### 7.2 Implémentation du nonce store côté Mac

```swift
actor NonceStore {
    // LRU limité à 1000 entrées, TTL 5 minutes
    private var seen: [Data: Date] = [:]
    private let ttl: TimeInterval = 300
    private let maxSize = 1000
    
    func checkAndRegister(_ nonce: Data) throws {
        pruneExpired()
        guard seen[nonce] == nil else {
            throw AuthError.nonceReuse
        }
        if seen.count >= maxSize {
            // Éjecte le plus ancien
            let oldest = seen.min(by: { $0.value < $1.value })!
            seen.removeValue(forKey: oldest.key)
        }
        seen[nonce] = Date()
    }
    
    private func pruneExpired() {
        let cutoff = Date().addingTimeInterval(-ttl)
        seen = seen.filter { $0.value > cutoff }
    }
}
```

### 7.3 Persistance du compteur

```swift
// iOS — sauvegarde dans Keychain après chaque auth
func persistCounter(_ counter: UInt64, pairingID: UUID) {
    var counterBytes = counter.bigEndian
    let counterData = Data(bytes: &counterBytes, count: 8)
    
    let query: [CFString: Any] = [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: "com.pcrmanager.counter",
        kSecAttrAccount: pairingID.uuidString,
        kSecValueData: counterData,
        kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    ]
    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
}
```

---

## 8. Mécanismes anti-MITM

### 8.1 Protection du pairing (échange de clés)

```
PROBLÈME: Un attaquant entre Mac et iPhone lors du scan QR pourrait substituer une clé.

SOLUTION: Key commitment + ECDH authentifié

1. Le QR contient la clé éphémère Mac + sa signature par la clé identity Mac
2. L'iPhone vérifie cette signature (au moins après le 1er pairing)
3. L'ECDH génère un shared secret que seuls Mac et iPhone connaissent
4. La réponse iPhone est chiffrée avec ce shared secret + signée avec la clé identity iPhone
5. Le Mac vérifie signature ET déchiffre → attaque MITM détectée si clé substituée
```

**Première utilisation (TOFU - Trust On First Use)** :
```
Lors du tout premier pairing, le Mac n'a pas encore de clé connue de l'iPhone.
→ Afficher sur les DEUX écrans une "empreinte" du shared secret pour confirmation visuelle.
→ Ex: 6 emoji ou 6 chiffres générés depuis SHA256(shared_secret)[:3]
→ L'utilisateur confirme que les deux affichages sont identiques.
```

### 8.2 Device ID binding

```swift
// Le challenge lie CRYPTOGRAPHIQUEMENT l'identifiant du Mac
// Une réponse ne peut être réutilisée que si l'attaquant connaît
// le MAC device ID + le nonce + le compteur = impossible sans clé privée

struct AuthChallenge {
    let macDeviceID: DeviceIdentifier  // inclus dans le payload signé
    // Si l'iPhone répond à un faux challenge (faux Mac),
    // la signature sera invalide côté vrai Mac (mauvais macDeviceID dans payload)
}
```

### 8.3 Certificate pinning post-pairing

```swift
// Après pairing, le Mac PIN la clé publique de l'iPhone.
// Toute réponse signée par une autre clé est rejetée.
// Pas de PKI, pas de CA compromise possible.

class PairedDevice {
    let pinnedPublicKey: P256.Signing.PublicKey  // stockée Keychain Mac
    
    func verifyIsFromPairedDevice(_ response: AuthResponse) throws {
        // Seule la clé pinnée est acceptée — aucune substitution possible
        guard pinnedPublicKey.isValidSignature(response.signature, for: payload) else {
            throw AuthError.unknownAuthenticator
        }
    }
}
```

### 8.4 Chiffrement du transport BLE

```
Bien que la signature protège l'intégrité, le channel BLE doit être chiffré
pour éviter la fuite de métadonnées (qui s'authentifie, quand).

→ Utiliser BLE avec "LE Secure Connections" (iOS/macOS 13+)
→ Ou chiffrer applicativement: AES-256-GCM avec une session key dérivée du pairing
```

---

## 9. Secure Enclave — Bonnes pratiques

### 9.1 Génération de la clé d'identité

```swift
import CryptoKit
import LocalAuthentication

class SecureEnclaveKeyManager {
    
    /// Génère une clé P-256 dans le Secure Enclave, protégée biométriquement.
    /// Cette clé ne peut JAMAIS être exportée ou clonée.
    func generateIdentityKey(pairingID: UUID) throws -> SecureEnclave.P256.Signing.PrivateKey {
        
        // Access Control : biométrie obligatoire + lié à cet appareil
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,  // efface si passcode supprimé
            [
                .privateKeyUsage,          // ne peut servir qu'à signer
                .biometryCurrentSet,       // invalide si biométrie change (ajout doigt)
                // Alternative: .biometryAny pour tolérer ajout d'empreintes
            ],
            &error
        ) else {
            throw error!.takeRetainedValue() as Error
        }
        
        let tag = iOSKeychainTag.identityKeyTag(pairingID: pairingID)
        
        // Création dans le Secure Enclave
        let key = try SecureEnclave.P256.Signing.PrivateKey(
            accessControl: access,
            authenticationContext: LAContext()  // contexte biométrique actif
        )
        
        // Sauvegarde de la représentation (data de récupération, pas la clé privée)
        try storeKeyReference(key.dataRepresentation, tag: tag)
        
        return key
    }
    
    /// Récupère la clé depuis le Secure Enclave.
    /// Déclenche Face ID/Touch ID via le LAContext fourni.
    func loadIdentityKey(pairingID: UUID, context: LAContext) throws -> SecureEnclave.P256.Signing.PrivateKey {
        let tag = iOSKeychainTag.identityKeyTag(pairingID: pairingID)
        let data = try loadKeyReference(tag: tag)
        
        return try SecureEnclave.P256.Signing.PrivateKey(
            dataRepresentation: data,
            authenticationContext: context  // contexte validé biométriquement
        )
    }
    
    /// Supprime définitivement la clé (révocation, unpair)
    func deleteIdentityKey(pairingID: UUID) throws {
        let tag = iOSKeychainTag.identityKeyTag(pairingID: pairingID)
        try deleteKeyReference(tag: tag)
        // Note: la clé dans Secure Enclave est automatiquement supprimée
        // avec la référence Keychain
    }
}
```

### 9.2 Signature avec biométrie préalable

```swift
class AuthenticatorService {
    
    func signChallenge(_ challenge: AuthChallenge, pairingID: UUID) async throws -> AuthResponse {
        
        // 1. Préparer le LAContext avec localizedReason UX-friendly
        let context = LAContext()
        context.localizedReason = "Connexion à PCR Manager sur votre Mac"
        context.localizedCancelTitle = "Annuler"
        
        // 2. Évaluer biométrie AVANT de charger la clé
        var authError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            throw AuthError.biometryUnavailable(authError)
        }
        
        // LAContext.evaluatePolicy est async natif iOS 16+
        let success = try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: context.localizedReason
        )
        guard success else {
            throw AuthError.biometryFailed
        }
        
        // 3. Charger la clé (utilise le context déjà validé → pas de 2ème prompt)
        let keyManager = SecureEnclaveKeyManager()
        let privateKey = try keyManager.loadIdentityKey(pairingID: pairingID, context: context)
        
        // 4. Calculer le payload à signer
        let counter = try loadAndIncrementCounter(pairingID: pairingID)
        let payload = SignedPayload.build(from: challenge, counter: counter)
        
        // 5. Signer dans le Secure Enclave
        let signature = try privateKey.signature(for: payload)
        
        // 6. Construire la réponse
        return AuthResponse(
            challengeID: challenge.challengeID,
            deviceID: DeviceIdentifier.current(),
            signature: signature.derRepresentation,
            counter: counter,
            timestamp: Date()
        )
    }
}
```

### 9.3 Attributs recommandés

| Attribut | Valeur recommandée | Raison |
|----------|-------------------|--------|
| `kSecAttrAccessible` | `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` | Efface si iPhone formaté/passcode retiré |
| Access Control flags | `.privateKeyUsage + .biometryCurrentSet` | Signature uniquement + invalide si biométrie change |
| Backup | Désactivé (ThisDeviceOnly) | Clé ne doit pas partir dans iCloud Backup |
| Exportable | Non (Secure Enclave garantit ça) | Invariant hardware |

### 9.4 Gestion du changement biométrique

```swift
// .biometryCurrentSet invalide la clé si une nouvelle empreinte/visage est ajouté.
// C'est une protection renforcée mais casse l'auth si l'utilisateur ajoute son conjoint.

// Si vous préférez tolérer l'ajout de biométries: utilisez .biometryAny
// Mais .biometryAny n'invalide pas si quelqu'un ajoute frauduleusement son empreinte.

// RECOMMANDATION: .biometryCurrentSet + flow de re-pairing guidé UX si la clé devient invalide.

func handleBiometryChanged(pairingID: UUID) async {
    // Détecter: LAError.biometryLockout ou erreur lors du chargement de clé
    // Afficher: "Votre Face ID a changé. Re-authentifiez-vous pour sécuriser votre iPhone."
    // Flow: re-pairing ou re-enrollment
}
```

---

## 10. Couche de communication

### 10.1 Architecture BLE (préconisée pour l'auth)

```
iPhone (GATT Client → Central)              macOS (GATT Server → Peripheral)
┌─────────────────────────────┐            ┌─────────────────────────────┐
│  Service: PCRManager-Auth   │            │  Service: PCRManager-Auth   │
│  UUID: [custom 128-bit]     │            │  UUID: [custom 128-bit]     │
│                             │            │                             │
│  Characteristics:           │            │  Characteristics:           │
│  • AUTH_CHALLENGE (read)    │◄──────────►│  • AUTH_CHALLENGE (write)   │
│  • AUTH_RESPONSE  (write)   │            │  • AUTH_RESPONSE  (notify)  │
│  • DEVICE_ID      (read)    │            │  • DEVICE_ID      (read)    │
└─────────────────────────────┘            └─────────────────────────────┘

Flow BLE:
1. Mac advertise le service PCRManager-Auth
2. iPhone détecte et se connecte (si iPhone appairé reconnu)
3. Mac lit DEVICE_ID de l'iPhone → vérifie dans sa liste de pairings
4. Mac écrit AuthChallenge dans AUTH_CHALLENGE
5. iPhone lit → biométrie → signature → écrit AuthResponse dans AUTH_RESPONSE
6. Mac reçoit notification → vérifie → ouvre session
```

### 10.2 UUIDs de service

```swift
enum BLEConstants {
    // Service principal (générer un UUID dédié à l'app)
    static let serviceUUID = CBUUID(string: "A4B1C2D3-E4F5-6789-ABCD-EF0123456789")
    
    // Characteristics
    static let challengeCharUUID = CBUUID(string: "B1C2D3E4-F5A6-789A-BCDE-F01234567890")
    static let responseCharUUID  = CBUUID(string: "C2D3E4F5-A6B7-89AB-CDEF-012345678901")
    static let deviceIDCharUUID  = CBUUID(string: "D3E4F5A6-B7C8-9ABC-DEF0-123456789012")
    
    // Taille max MTU négociée (iOS 13+)
    static let maxPayloadSize = 512  // bytes, suffisant pour AuthChallenge/Response
}
```

### 10.3 MultipeerConnectivity (pairing)

```swift
// Pour le pairing initial (échange bidirectionnel, pas de contrainte taille)
import MultipeerConnectivity

class PairingMPCSession: NSObject {
    let serviceType = "pcrmanager-pair"  // 15 chars max, lowercase, hyphens OK
    let myPeerID: MCPeerID
    var session: MCSession?
    var browser: MCNearbyServiceBrowser?
    var advertiser: MCNearbyServiceAdvertiser?
    
    // macOS: annonce sa disponibilité avec invitationID dans les discoveryInfo
    func startAdvertising(invitationID: UUID) {
        let info = ["inv": invitationID.uuidString, "v": "1"]
        advertiser = MCNearbyServiceAdvertiser(peer: myPeerID, discoveryInfo: info, serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()
    }
    
    // iPhone: cherche le Mac après scan QR (connaît l'invitationID)
    func startBrowsing(expectedInvitationID: UUID) {
        browser = MCNearbyServiceBrowser(peer: myPeerID, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
        // Filtrer sur discoveryInfo["inv"] == expectedInvitationID
    }
}
```

### 10.4 Sélection du transport

```
Cas d'usage        Transport recommandé     Raison
─────────────────  ──────────────────────   ────────────────────────
Pairing initial    MultipeerConnectivity    Bidirectionnel, gère NAT
Auth quotidienne   CoreBluetooth (BLE)      Background, < 100ms
Fallback réseau    Bonjour + TCP local      Si BLE indisponible
```

---

## 11. Intégration Tauri (Mac)

### 11.1 Architecture hybride

```
┌─────────────────────────────────────────────────────────────────┐
│  macOS Process                                                   │
│  ┌──────────────────┐    IPC     ┌─────────────────────────┐   │
│  │  Tauri (Rust)    │◄──────────►│  Swift Helper Process   │   │
│  │  ─────────────── │  Unix sock │  ───────────────────── │   │
│  │  • Logique métier│            │  • CoreBluetooth        │   │
│  │  • Base de données│           │  • MultipeerConnectivity │   │
│  │  • Session state │            │  • Keychain             │   │
│  │  • Commandes API │            │  • CryptoKit            │   │
│  └──────────────────┘            │  • QR Code génération   │   │
│                                  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Option A** : XPC Service Swift (recommandé)
- Le helper Swift est un XPC service signé, isolation sandbox
- Tauri communique via `tauri-plugin-shell` ou socket local

**Option B** : Plugin Tauri en Swift via `tauri-plugin` + FFI
- Plus intégré mais plus complexe à maintenir

**Option C** : Migration vers SwiftUI App (long terme)
- Abandon de Tauri, réécriture native
- Performance optimale, accès complet aux frameworks Apple

### 11.2 Interface Tauri → Swift

```rust
// Côté Rust (Tauri) — commandes exposées au frontend
#[tauri::command]
async fn start_pairing(state: State<'_, AuthState>) -> Result<PairingQRData, AuthError> {
    state.swift_bridge.start_pairing().await
}

#[tauri::command]
async fn get_auth_status(state: State<'_, AuthState>) -> Result<AuthStatus, AuthError> {
    state.session.lock().await.status()
}

// Le Swift helper notifie Tauri via événements
// state.app_handle.emit("auth:success", payload)
// state.app_handle.emit("auth:failed", reason)
// state.app_handle.emit("pairing:complete", pairingRecord)
```

### 11.3 Stockage côté Mac

```swift
// Swift Helper — gestion Keychain macOS
class MacKeychainManager {
    
    func storePairingRecord(_ record: PairingRecord) throws {
        let data = try JSONEncoder().encode(record)
        let query: [CFString: Any] = [
            kSecClass:           kSecClassGenericPassword,
            kSecAttrService:     "com.pcrmanager.pairing",
            kSecAttrAccount:     record.pairingID.uuidString,
            kSecValueData:       data,
            // Accessible uniquement quand Mac déverrouillé
            kSecAttrAccessible:  kSecAttrAccessibleWhenUnlocked,
            // Lié à cet appareil Mac (pas dans iCloud Keychain)
            kSecAttrSynchronizable: false
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.writeFailed(status) }
    }
    
    func storePeerPublicKey(_ keyData: Data, pairingID: UUID) throws {
        // Stocke la clé publique P-256 de l'iPhone (65 bytes, format x963)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassKey,
            kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeyClass:kSecAttrKeyClassPublic,
            kSecAttrLabel:   MacKeychainKey.peerPublicKey(pairingID: pairingID),
            kSecValueData:   keyData,
            kSecAttrAccessible: kSecAttrAccessibleWhenUnlocked
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
}
```

---

## 12. Pseudo-code Swift complet

### 12.1 iOS — App complète (points clés)

```swift
// ─── iOSAuthenticatorApp.swift ───

@main
struct PCRAuthApp: App {
    @StateObject var pairingManager = PairingManager()
    @StateObject var authManager = AuthManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(pairingManager)
                .environmentObject(authManager)
                .onOpenURL { url in
                    // Gestion deep link: pcrauth://pair?...
                    pairingManager.handlePairingURL(url)
                }
        }
    }
}

// ─── PairingManager.swift (iOS) ───

@MainActor
class PairingManager: NSObject, ObservableObject {
    @Published var pairingState: PairingState = .idle
    @Published var pendingInvitation: PairingInvitation?
    
    private let keyManager = SecureEnclaveKeyManager()
    private var mpcSession: PairingMPCSession?
    
    enum PairingState {
        case idle, scanningQR, confirmingWithUser, exchangingKeys, completed, failed(Error)
    }
    
    func handlePairingURL(_ url: URL) {
        guard let invitation = try? PairingInvitation.from(url: url) else { return }
        
        // Valider timestamp
        guard abs(invitation.timestamp.timeIntervalSinceNow) < 300 else {
            pairingState = .failed(PairingError.invitationExpired)
            return
        }
        
        pendingInvitation = invitation
        pairingState = .confirmingWithUser
    }
    
    func confirmPairing() async throws {
        guard let invitation = pendingInvitation else { throw PairingError.noInvitation }
        
        pairingState = .exchangingKeys
        
        // 1. Générer la clé d'identité dans Secure Enclave
        let pairingID = UUID()
        let identityKey = try keyManager.generateIdentityKey(pairingID: pairingID)
        let identityPublicKey = identityKey.publicKey.x963Representation
        
        // 2. Générer une clé éphémère pour ECDH
        let ephemeralKey = P256.KeyAgreement.PrivateKey()
        
        // 3. ECDH avec la clé éphémère du Mac
        let macEphemeralKey = try P256.KeyAgreement.PublicKey(x963Representation: invitation.macEphemeralPublicKey)
        let sharedSecret = try ephemeralKey.sharedSecretFromKeyAgreement(with: macEphemeralKey)
        let sessionKey = SymmetricKey(
            data: HKDF<SHA256>.deriveKey(
                inputKeyMaterial: sharedSecret,
                salt: invitation.nonce,
                info: Data("PCRManager-Pairing-v1".utf8),
                outputByteCount: 32
            )
        )
        
        // 4. Signer le hash de l'invitation avec la clé identité
        let invitationHash = SHA256.hash(data: try JSONEncoder().encode(invitation))
        let signature = try identityKey.signature(for: Data(invitationHash))
        
        // 5. Construire la réponse
        var response = PairingResponse(
            invitationID: invitation.invitationID,
            iphoneDeviceID: DeviceIdentifier.current(),
            iphoneDeviceName: UIDevice.current.name,
            iphoneIdentityPublicKey: identityPublicKey,
            iphoneEphemeralPublicKey: ephemeralKey.publicKey.x963Representation,
            signature: signature.derRepresentation,
            timestamp: Date()
        )
        
        // 6. Chiffrer avec la session key AES-GCM
        let encryptedResponse = try AES.GCM.seal(try JSONEncoder().encode(response), using: sessionKey)
        
        // 7. Envoyer via MPC
        try await mpcSession!.send(encryptedResponse.combined!)
        
        // 8. Attendre confirmation Mac
        let confirmation = try await mpcSession!.receive()
        
        // 9. Stocker le pairing record
        let record = PairingRecord(
            pairingID: pairingID,
            pairedAt: Date(),
            authCounter: 0,
            peerPublicKey: invitation.macEphemeralPublicKey,  // ou identity key Mac si envoyée
            peerDeviceID: invitation.macDeviceID,
            peerDeviceName: invitation.macDeviceName,
            keychainTag: iOSKeychainTag.identityKeyTag(pairingID: pairingID).base64EncodedString()
        )
        try StorageManager.shared.savePairingRecord(record)
        
        pairingState = .completed
    }
}

// ─── AuthManager.swift (iOS) ───

@MainActor
class AuthManager: NSObject, ObservableObject {
    @Published var authState: AuthState = .idle
    
    private let keyManager = SecureEnclaveKeyManager()
    private var bleManager: BLEAuthManager?
    
    enum AuthState {
        case idle, pendingBiometry, signing, completed, failed(Error)
    }
    
    /// Appelé quand un challenge BLE est reçu du Mac
    func handleAuthChallenge(_ challenge: AuthChallenge) async {
        authState = .pendingBiometry
        
        do {
            // Trouver le pairing correspondant
            guard let pairing = StorageManager.shared.findPairing(pairingID: challenge.pairingID) else {
                authState = .failed(AuthError.unknownPairing)
                return
            }
            
            // Valider le challenge
            try validateIncomingChallenge(challenge, pairing: pairing)
            
            // Demander biométrie et signer
            let response = try await AuthenticatorService().signChallenge(challenge, pairingID: pairing.pairingID)
            
            authState = .signing
            
            // Envoyer la réponse via BLE
            try await bleManager?.sendResponse(response)
            
            // Mettre à jour le compteur local
            try StorageManager.shared.updateCounter(pairing.pairingID, counter: response.counter)
            
            authState = .completed
            
        } catch {
            authState = .failed(error)
        }
    }
    
    private func validateIncomingChallenge(_ challenge: AuthChallenge, pairing: PairingRecord) throws {
        // Vérifier macDeviceID
        guard challenge.macDeviceID == pairing.peerDeviceID else {
            throw AuthError.deviceMismatch
        }
        // Vérifier timestamp
        guard abs(challenge.timestamp.timeIntervalSinceNow) < 30 else {
            throw AuthError.challengeExpired(age: challenge.timestamp.timeIntervalSinceNow)
        }
        // Vérifier counter
        guard challenge.expectedCounter > pairing.authCounter else {
            throw AuthError.counterReplay(received: challenge.expectedCounter, stored: pairing.authCounter)
        }
        // Vérifier appBundleID
        guard challenge.appBundleID == Bundle.main.bundleIdentifier.map({ $0.replacingOccurrences(of: "ios", with: "mac") }) else {
            throw AuthError.appMismatch
        }
    }
}
```

### 12.2 macOS — Swift Helper (points clés)

```swift
// ─── MacAuthVerifier.swift ───

class MacAuthVerifier {
    private let keychainManager = MacKeychainManager()
    private let nonceStore = NonceStore()
    
    func processAuthResponse(_ response: AuthResponse, challenge: AuthChallenge) async throws -> Bool {
        
        // 1. Charger le pairing record
        guard let pairing = try keychainManager.loadPairingRecord(deviceID: response.deviceID) else {
            throw AuthError.unknownDevice
        }
        
        // 2. Vérifier le nonce (anti-replay)
        try await nonceStore.checkAndRegister(challenge.nonce)
        
        // 3. Vérifier toutes les conditions
        try verifyAuthResponse(response, challenge: challenge, pairingRecord: pairing)
        
        // 4. Mettre à jour le pairing record
        var updatedPairing = pairing
        updatedPairing.authCounter = response.counter
        updatedPairing.lastAuthAt = Date()
        try keychainManager.updatePairingRecord(updatedPairing)
        
        return true
    }
}

// ─── MacBLEServer.swift ───

class MacBLEServer: NSObject, CBPeripheralManagerDelegate {
    var peripheralManager: CBPeripheralManager!
    var challengeChar: CBMutableCharacteristic!
    var responseChar: CBMutableCharacteristic!
    
    private var pendingChallenge: AuthChallenge?
    private var continuation: CheckedContinuation<AuthResponse, Error>?
    
    func startAdvertising() {
        peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
    }
    
    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn else { return }
        setupGATTProfile()
        peripheral.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [BLEConstants.serviceUUID],
            CBAdvertisementDataLocalNameKey: "PCRManager"
        ])
    }
    
    private func setupGATTProfile() {
        challengeChar = CBMutableCharacteristic(
            type: BLEConstants.challengeCharUUID,
            properties: [.write, .writeWithoutResponse],
            value: nil,
            permissions: [.writeable]
        )
        responseChar = CBMutableCharacteristic(
            type: BLEConstants.responseCharUUID,
            properties: [.read, .notify],
            value: nil,
            permissions: [.readable]
        )
        let service = CBMutableService(type: BLEConstants.serviceUUID, primary: true)
        service.characteristics = [challengeChar, responseChar]
        peripheralManager.add(service)
    }
    
    /// Lance un cycle auth complet — async/await
    func requestAuthentication(pairingID: UUID) async throws -> AuthResponse {
        let challenge = buildChallenge(pairingID: pairingID)
        pendingChallenge = challenge
        
        let challengeData = try JSONEncoder().encode(challenge)
        peripheralManager.updateValue(challengeData, for: challengeChar, onSubscribedCentrals: nil)
        
        return try await withCheckedThrowingContinuation { cont in
            continuation = cont
            // Timeout 30 secondes
            Task {
                try await Task.sleep(nanoseconds: 30_000_000_000)
                cont.resume(throwing: AuthError.timeout)
            }
        }
    }
    
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        guard let request = requests.first,
              request.characteristic.uuid == BLEConstants.responseCharUUID,
              let data = request.value,
              let response = try? JSONDecoder().decode(AuthResponse.self, from: data)
        else { return }
        
        peripheral.respond(to: request, withResult: .success)
        continuation?.resume(returning: response)
        continuation = nil
    }
    
    private func buildChallenge(pairingID: UUID) -> AuthChallenge {
        var nonceBytes = [UInt8](repeating: 0, count: 32)
        SecRandomCopyBytes(kSecRandomDefault, 32, &nonceBytes)
        
        return AuthChallenge(
            challengeID: UUID(),
            nonce: Data(nonceBytes),
            timestamp: Date(),
            macDeviceID: DeviceIdentifier.current(),
            pairingID: pairingID,
            expectedCounter: loadCurrentCounter(pairingID: pairingID) + 1,
            appBundleID: Bundle.main.bundleIdentifier!
        )
    }
}
```

---

## 13. Recommandations UX

### 13.1 Flow d'appairage

```
┌─────────────────────────────────────────────────────────────────┐
│  ÉCRAN MAC — APPAIRAGE                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   Connectez votre iPhone pour sécuriser PCR Manager    │   │
│  │                                                         │   │
│  │         ┌─────────────────────────┐                    │   │
│  │         │  ▄▄▄▄▄▄▄ ▄  ▄ ▄▄▄▄▄▄▄  │                    │   │
│  │         │  █     █ ██▄█ █     █  │                    │   │
│  │         │  █ ▄▄▄ █ ▄▄▄▄ █ ▄▄▄ █  │                    │   │
│  │         │  █ ███ █ ▄▄ ▄ █ ███ █  │  QR Code           │   │
│  │         │  █▄▄▄▄▄█ ▄ ▄▄ █▄▄▄▄▄█  │                    │   │
│  │         │  ▄▄▄▄ ▄ ▄▄ █▄▄ ▄▄▄▄▄▄  │                    │   │
│  │         └─────────────────────────┘                    │   │
│  │                                                         │   │
│  │   Ouvrez PCR Authenticator sur votre iPhone            │   │
│  │   et scannez ce code.                                  │   │
│  │                                                         │   │
│  │   ⏱ Expire dans 4:32                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ÉCRAN iPhone — CONFIRMATION                                    │
│                                                                 │
│  "MacBook Pro de Jean"                                          │
│  veut s'associer à votre iPhone                                 │
│                                                                 │
│  Votre iPhone deviendra la clé de connexion                     │
│  pour cette application.                                        │
│                                                                 │
│  Empreinte de sécurité : 🦊 🌙 🎸                              │
│  (à vérifier avec l'affichage sur le Mac)                      │
│                                                                 │
│  [ Associer ]    [ Annuler ]                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Flow d'authentification

```
┌─────────────────────────────────────────────────────────────────┐
│  ÉCRAN MAC — EN ATTENTE                                         │
│                                                                 │
│         ⠿  Validation sur votre iPhone…                        │
│                                                                 │
│         iPhone de Jean ████████████░░  En cours                │
│                                                                 │
│         [ Utiliser un autre appareil ]                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  IPHONE — NOTIFICATION (si app en background)                   │
│                                                                 │
│  🔐 PCR Manager                             maintenant          │
│  Connexion demandée depuis votre Mac.                           │
│  Appuyez pour authentifier.                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  IPHONE — BIOMÉTRIE                                             │
│                                                                 │
│  [Face ID animation]                                            │
│  "Connexion à PCR Manager"                                      │
│                                                                 │
│  ✓ → retour automatique à ce qu'on faisait                     │
└─────────────────────────────────────────────────────────────────┘
```

### 13.3 Règles UX critiques

| Règle | Mise en œuvre |
|-------|--------------|
| Délai < 3 secondes | Pre-connect BLE en arrière-plan dès l'ouverture du Mac |
| Pas de friction | Notification push si app iPhone fermée |
| Feedback immédiat | Spinner Mac pendant biométrie iPhone |
| Erreur claire | Message si iPhone hors portée / biométrie échouée |
| Fallback | Code PIN d'urgence 6 chiffres (stocké Secure Enclave) |
| Révocation simple | "Supprimer cet iPhone" dans les préférences Mac |
| Multi-device | Gérer N iPhones appairés, interface de liste |

---

## 14. Risques de sécurité

### 14.1 Matrice des risques

| Menace | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Vol physique iPhone | Moyenne | Critique | Biométrie obligatoire, pas d'auth sans Face ID |
| Clonage Secure Enclave | Très faible | Critique | Impossible par design hardware |
| Replay d'une signature | Faible | Critique | Nonce + timestamp + compteur |
| MITM lors pairing | Faible | Critique | ECDH + vérification empreinte visuelle |
| Brute-force signature | Nul | — | P-256 → 2^128 sécurité |
| Compromission Mac | Moyenne | Élevé | Clé privée jamais sur Mac, session limitée |
| BLE eavesdropping | Moyenne | Faible | Signatures publiques, chiffrement optionnel |
| Fausse app iPhone | Faible | Critique | Provenance App Store, signature Apple |
| iPhone formaté | Faible | Moyen | Flow re-pairing guidé |
| Biométrie usurpée (photo) | Très faible | Critique | Face ID 3D résistant aux photos |

### 14.2 Risques spécifiques à documenter

**Risque 1 : iPhone volé puis déverrouillé de force**
- Mitigation : `.biometryCurrentSet` expire la clé si le passcode est changé
- Résiduel : fenêtre entre vol et signalement (mitigation : alerte Mac si auth distante)

**Risque 2 : Attaque par émulation BLE**
- Un attaquant clone le service BLE et envoie de faux challenges
- Mitigation : le challenge inclut le macDeviceID → la signature sera invalide côté vrai Mac
- L'attaquant ne peut pas vérifier la signature → aucun gain

**Risque 3 : Jailbreak iPhone**
- Secure Enclave résiste au jailbreak (isolation hardware)
- Mais les hooks LocalAuthentication peuvent être bypassed
- Mitigation : utiliser `LAContext.evaluatedPolicyDomainState` pour détecter les altérations

```swift
// Détection de manipulation de l'environnement biométrique
func verifyBiometryIntegrity(_ context: LAContext) throws {
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        throw SecurityError.biometryCompromised
    }
    // evaluatedPolicyDomainState change si le jailbreak altère LocalAuthentication
    // Sauvegarder après enrollment, comparer à chaque auth
    if let storedState = loadStoredBiometryState(),
       storedState != context.evaluatedPolicyDomainState {
        throw SecurityError.biometryStateChanged
    }
}
```

**Risque 4 : Attaque de proximité BLE (relay attack)**
- Un attaquant relaie les messages BLE depuis un iPhone qui n'est pas physiquement proche
- Mitigation : mesurer le RSSI BLE, rejeter si < -80 dBm (distance > ~5m)
- Alternative : ajouter UWB (Ultra Wideband) pour localisation précise (iPhone 11+, Mac M1+)

---

## 15. Limites techniques

| Limitation | Description | Contournement |
|------------|-------------|---------------|
| Secure Enclave P-256 uniquement | Ed25519 non supporté | Utiliser P-256/ECDSA natif |
| BLE background iOS | iOS limite BLE en background | Push notifications pour réveil |
| Mac sans BLE | Rares machines virtuelles | Fallback réseau local (Bonjour) |
| iPhone sans Face ID | iPhone 8 et antérieurs | Touch ID fonctionne (même framework) |
| Perte iPhone | Plus d'accès sans re-pairing | Code PIN de secours (Secure Enclave) |
| Changement biométrie | .biometryCurrentSet invalide la clé | Flow de re-enrollment guidé |
| Tauri + Swift | Interop complexe | XPC service ou migration native |
| MultipeerConnectivity | Pas de background prolongé | Passer en BLE pour auth quotidienne |
| Offline strict | Le pairing initial nécessite les deux appareils | Par définition — pas de cloud |
| Révocation instantanée | Pas de mécanisme de révocation temps réel | Timeout session Mac (15 min) |

---

## 16. Alternatives

### 16.1 Alternatives au Secure Enclave

| Alternative | Avantage | Inconvénient |
|-------------|----------|--------------|
| **Passkeys Apple** (AuthenticationServices) | Standard WebAuthn, multi-device via iCloud | Nécessite internet pour sync, moins de contrôle |
| **CryptoTokenKit** | Standard d'authentification système | Complexité, usage enterprise |
| **Keychain sans Secure Enclave** | Compatibilité étendue | Clé extractable si iPhone compromis |
| **Code PIN local** | Toujours accessible | Moins sécurisé, attaque bruteforce possible |

### 16.2 Alternatives au transport BLE

| Alternative | Avantage | Inconvénient |
|-------------|----------|--------------|
| **Ultra Wideband (Nearby Interaction)** | Localisation précise, résistance relay attack | iPhone 11+ et Mac Apple Silicon requis |
| **NFC** | Contact physique = preuve de proximité | iOS n'autorise pas NFC background arbitraire |
| **Réseau local WiFi** | Portée supérieure | Requiert même réseau, MITM possible |
| **AirDrop** | Natif Apple | Pas d'API publique pour données custom |
| **iCloud Relay** | Pas de même réseau requis | Nécessite internet, stockage cloud |

### 16.3 Alternatives à l'architecture complète

**Option A : Apple Passkeys standard**
- Utiliser `ASAuthorizationPlatformPublicKeyCredentialProvider`
- Sync automatique via iCloud Keychain
- ⚠ Perd le contrôle offline et la confidentialité

**Option B : FIDO2 Hardware Key (YubiKey)**
- Clé physique USB-C/NFC
- Pas besoin d'app iPhone
- ⚠ Coût, perte physique, moins ergonomique

**Option C : Smart Card + CryptoTokenKit**
- Standard enterprise
- ⚠ Complexité MDM, usage enterprise uniquement

---

## 17. Schémas de communication

### 17.1 Vue globale des canaux

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   iPhone                          macOS                              │
│  ┌──────────┐                    ┌──────────────────────────────┐   │
│  │          │ ←── QR Code ───    │  Écran                       │   │
│  │  Camera  │    (optique)       │  (génère PairingInvitation)  │   │
│  └──────────┘                    └──────────────────────────────┘   │
│       │                                       │                      │
│       │  PAIRING (une seule fois)             │                      │
│       │ ←── MultipeerConnectivity ──────────► │                      │
│       │     (WiFi Direct ou BLE)              │                      │
│       │     • PairingResponse (chiffrée)      │                      │
│       │     • Confirmation                    │                      │
│       │                                       │                      │
│       │  AUTHENTIFICATION (quotidien)         │                      │
│       │ ←── CoreBluetooth BLE GATT ─────────► │                      │
│       │     • AuthChallenge (Mac → iPhone)    │                      │
│       │     • AuthResponse  (iPhone → Mac)    │                      │
│       │                                       │                      │
│       │  NOTIFICATION (si app fermée)         │                      │
│       │ ←── APNs / Local Notification ──      │                      │
│       │     (réveil pour auth)                │                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 17.2 États de la machine d'état (Mac)

```
         [IDLE]
            │
            │ App ouvre
            ▼
    [WAITING_FOR_IPHONE] ←── BLE scan actif
            │
            │ iPhone détecté et reconnu
            ▼
    [CHALLENGE_SENT] ─────── timeout 30s ──► [AUTH_FAILED]
            │
            │ Réponse reçue
            ▼
    [VERIFYING] ──────────── erreur ────────► [AUTH_FAILED]
            │
            │ Signature valide
            ▼
      [AUTHENTICATED] ──── timeout 15min ──► [IDLE]
            │
            │ Logout explicite
            ▼
          [IDLE]
```

### 17.3 États de la machine d'état (iPhone)

```
         [IDLE]
            │
            │ BLE auth service connecté au Mac
            ▼
   [CHALLENGE_RECEIVED]
            │
            │ Validation OK
            ▼
    [BIOMETRY_PENDING] ──── échec/cancel ──► [IDLE]
            │
            │ Biométrie validée
            ▼
      [SIGNING] ──────────── erreur Secure Enclave ── [IDLE]
            │
            │ Signature produite
            ▼
   [RESPONSE_SENT] ─────────────────────────► [IDLE]
```

---

## Annexe A — Checklist d'implémentation

### Phase 1 — Infrastructure (Semaine 1-2)
- [ ] App iOS basique avec scan QR code
- [ ] Génération clé Secure Enclave sur iPhone
- [ ] Génération QR code côté Mac (Swift helper)
- [ ] Échange via MultipeerConnectivity

### Phase 2 — Cryptographie (Semaine 2-3)
- [ ] ECDH pairing + HKDF session key
- [ ] Signature P-256 challenge/response
- [ ] Vérification ECDSA côté Mac
- [ ] Stockage Keychain (Mac + iPhone)

### Phase 3 — Transport BLE (Semaine 3-4)
- [ ] GATT Server Mac
- [ ] GATT Client iPhone
- [ ] Détection automatique iPhone appairé
- [ ] Notification push si iPhone en background

### Phase 4 — Anti-replay & Sécurité (Semaine 4-5)
- [ ] NonceStore avec TTL
- [ ] Compteur monotone persistant
- [ ] Validation fenêtre temporelle
- [ ] Chiffrement transport AES-GCM

### Phase 5 — Intégration Tauri (Semaine 5-6)
- [ ] XPC Service Swift pour Mac
- [ ] Bridge Rust → Swift (socket ou XPC)
- [ ] Commandes Tauri : start_pairing, get_auth_status
- [ ] Events Tauri : auth:success, auth:failed

### Phase 6 — UX & Polish (Semaine 6-7)
- [ ] UI d'appairage (Mac + iPhone)
- [ ] Notification push iPhone
- [ ] Gestion des erreurs utilisateur
- [ ] Flow de re-pairing si biométrie changée
- [ ] Révocation / suppression pairing

---

## Annexe B — Dépendances

### iOS
```
// Package.swift ou Xcode
dependencies: [
    // Aucune dépendance externe requise
    // Tout est fourni par Apple SDK:
    // CryptoKit, LocalAuthentication, CoreBluetooth,
    // MultipeerConnectivity, Security, AuthenticationServices
]
```

### macOS (Swift Helper)
```
// Mêmes frameworks Apple, plus:
import IOKit  // pour récupérer l'UUID machine (IOPlatformUUID)
```

### Rust (Tauri)
```toml
[dependencies]
# Pour vérification ECDSA P-256 en Rust (si on n'utilise pas Swift pour ça)
p256 = { version = "0.13", features = ["ecdsa"] }
sha2 = "0.10"
# Communication avec le Swift Helper
tokio = { version = "1", features = ["full"] }
```

---

*Document généré — Mai 2026 — PCR Manager Auth Architecture v1.0*
