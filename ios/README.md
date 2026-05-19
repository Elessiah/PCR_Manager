# PCR Authenticator — App iOS

Application iOS servant d'authentificateur sécurisé pour PCR Manager sur macOS.

## Prérequis

- Xcode 15+
- iOS 16.0 minimum
- iPhone avec Secure Enclave (iPhone 5s ou plus récent)
- Face ID ou Touch ID activé
- iPhone et Mac sur le même réseau Wi-Fi (pour l'appairage et l'authentification)

## Configuration Xcode

### Bundle ID
```
com.pcrmanager.ios
```

### URL Scheme
Ajouter dans `Info.plist` → `CFBundleURLTypes` :
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>pcrauth</string>
    </array>
  </dict>
</array>
```

### Info.plist — Descriptions d'usage
```xml
<key>NSFaceIDUsageDescription</key>
<string>Utilisé pour sécuriser la connexion à PCR Manager sur votre Mac</string>

<key>NSCameraUsageDescription</key>
<string>Utilisé pour scanner les QR codes de connexion affichés par PCR Manager</string>
```

### Capabilities
- **Keychain Sharing** : non requis (Keychain items locaux uniquement)
- La clé P-256 dans le Secure Enclave n'est pas synchronisée iCloud

## Fichiers source

| Fichier | Rôle |
|---------|------|
| `PCRAuthApp.swift` | Point d'entrée, gestion URL scheme |
| `ContentView.swift` | UI principale + feuilles modales |
| `ScannerView.swift` | Scanner QR (AVFoundation) |
| `PairingManager.swift` | Flux d'appairage (génération clé, signature, HTTP) |
| `AuthManager.swift` | Flux d'authentification (Face ID, signature, HTTP) |
| `SecureEnclaveKeyManager.swift` | Gestion des clés P-256 dans le Secure Enclave |
| `NetworkClient.swift` | Client HTTP minimal (POST JSON) |
| `Models.swift` | Structures de données partagées |

## Flux de sécurité

### Appairage (une seule fois)
1. PCR Manager sur Mac génère un QR code contenant :
   - `host`, `port` du serveur temporaire Mac
   - `invitation_id` (UUID unique)
   - `nonce` (32 bytes aléatoires)
   - `mac_device_id` (hash SHA-256 stable)

2. L'iPhone scanne le QR, génère une clé P-256 dans le **Secure Enclave**
   - Attributs : `biometryCurrentSet` + `privateKeyUsage` + `whenPasscodeSetThisDeviceOnly`
   - La clé **ne quitte jamais** le Secure Enclave

3. L'iPhone signe `SHA256(invitation_id_bytes || nonce)` avec sa clé Secure Enclave

4. L'iPhone POST au Mac :
   - Sa clé publique P-256 (65 bytes, format x963)
   - La signature ECDSA-P256-SHA256

5. Le Mac vérifie la signature et stocke la clé publique dans son Keychain

### Authentification (quotidienne)
1. PCR Manager génère un QR challenge :
   - `challenge_id`, `nonce`, `mac_device_id`, `counter` attendu

2. L'iPhone scanne, demande **Face ID / Touch ID**

3. La Secure Enclave signe le payload :
   ```
   SHA256(challenge_id || nonce || timestamp_ms_be || mac_device_id || counter_be || "com.pcrmanager.ios")
   ```

4. L'iPhone POST la signature au Mac (compteur incrémenté)

5. Le Mac vérifie avec la clé publique stockée → ouvre la session

### Garanties de sécurité
- **Anti-rejeu** : nonce + timestamp (±30s) + compteur monotone
- **Binding appareil** : `mac_device_id` dans le payload signé
- **Biométrie obligatoire** : `biometryCurrentSet` dans l'access control
- **Clé non exportable** : Secure Enclave hardware guarantee
- **Offline** : aucun serveur distant, aucun cloud, réseau local uniquement

## Développement

```bash
# Ouvrir dans Xcode
open ios/PCRAuth.xcodeproj

# Ou créer un nouveau projet Xcode et y copier les sources
# File > New > Project > iOS App
# Product Name : PCR Authenticator
# Bundle ID : com.pcrmanager.ios
# Language : Swift
# Interface : SwiftUI
```

## Limites connues

- L'appairage et l'authentification requièrent le **même réseau Wi-Fi** (MVP)
- La Phase 2 ajoutera BLE pour une authentification sans réseau
- Si Face ID est modifié (nouvelle empreinte), la clé Secure Enclave est invalidée → re-pairing nécessaire (par design, attribut `biometryCurrentSet`)
