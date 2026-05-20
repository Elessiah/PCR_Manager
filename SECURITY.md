# Sécurité — PCR Manager

## 1. Architecture générale

PCR Manager est une application Tauri (desktop Mac/Windows) pour la gestion de dossiers de radioprotection. Le frontend est servi localement sur `http://127.0.0.1:1420` (via tauri-plugin-localhost), sans exposition réseau externe. Les données résident dans une base SQLite chiffrée (SQLCipher) sur la machine de l'opérateur (PCR). Aucune transmission cloud, aucune API tierce — les données restent isolées sur le poste de travail.

## 2. Authentification

**Méthode** : iPhone Secure Enclave P-256 ECDSA (passwordless)

**Flux d'appairage** (une seule fois) :
- Mac génère `invitation_id` (UUID) + `nonce` (32 bytes aléatoires)
- Mac démarre un serveur HTTP temporaire sur le réseau local (port aléatoire)
- QR code transmis à l'iPhone : `pcrauth://pair?v=1&host=…&port=…&id=…&nonce=…&mac_id=…`
- iPhone scanne → Secure Enclave signe SHA-256(`invitation_id` || `nonce`) → HTTP POST → Mac vérifie signature ECDSA et stocke clé publique P-256

**Flux d'authentification** (quotidien) :
- Mac génère `challenge_id` (UUID) + `nonce` (32 bytes) + serveur HTTP
- QR code : `pcrauth://auth?v=1&host=…&port=…&challenge_id=…&nonce=…&mac_id=…&pairing_id=…&counter=…`
- iPhone scanne → Face ID déverrouille Secure Enclave → signe challenge → HTTP POST → Mac vérifie signature et compteur anti-rejeu
- Compteur monotone pour éviter les rejeux de signature

**Durée TTL** :
- Pairing challenge : 300 secondes (5 min), fenêtre timestamp ±300 secondes
- Auth challenge : 60 secondes, fenêtre timestamp ±30 secondes
- Clé privée P-256 : reste toujours dans le Secure Enclave iPhone (jamais transmise)

**Session** : états authentifié/déauthentifié en mémoire (SessionState, Mutex<bool>), effacé à la fermeture de l'app

## 3. Chiffrement de la base de données

**Moteur** : SQLCipher (crate rusqlite 0.31, feature `bundled-sqlcipher-vendored-openssl`)

**Algorithme** : AES-256 (default SQLCipher)

**Clé de chiffrement** :
- UUID v4 généré à la première ouverture
- Stocké dans le trousseau OS via crate `keyring` v2 (Windows Credential Manager / macOS Keychain)
- Entrée trousseau : service="PCRManager", account="db_encryption_key"
- Clé jamais transmise en clair dans le code applicatif
- PRAGMA key appliquée à la connexion via `conn.execute_batch("PRAGMA key = '…'")`

**Modes** : WAL activé (PRAGMA journal_mode = WAL) pour intégrité transactionnelle

## 4. Protection des données sensibles

**Champs sensibles** (RGPD Art. 9 — données de catégorie spéciale) :
- `numero_securite_sociale` (NIR) : identifiant de sécurité sociale, base légale Code du travail L4451-1 et R4453-1
- `numero_porteur_dosimetrie_passive` : identifiant de suivi médical
- `numero_suivi_medical` : données de santé liées à la dosimétrie

**Protection** : Toutes les données résident dans la base SQLCipher chiffrée AES-256

**Validation à l'entrée** (validators.rs) :
- NSS : 15 caractères alphanumérique, format strict
- Email : présence de @ et . après domaine
- Date : ISO 8601 (`YYYY-MM-DD`)

## 5. Journalisation des accès (RGPD Art. 32)

**Table** : `journal_acces` (migration V8)

**Schéma** :
- `id` : clé primaire
- `horodatage` : timestamp automatique `datetime('now')`
- `operation` : LECTURE | CREATION | MODIFICATION | SUPPRESSION
- `entite` : nom de la table (ex: travailleur)
- `entite_id` : ID de la ligne accédée
- `champ_nir` : 1 si la requête concerne le NIR, 0 sinon

**Index** : `idx_ja_horodatage` sur horodatage

**Couverture** : Fonction `log_acces()` appelée pour chaque opération sur la table travailleur

**Accès au journal** : Commande Tauri `journal_acces_list` (authentification requise), retourne 500 derniers événements

**Chiffrement** : Journal stocké dans la même base SQLCipher (chiffrement transparent)

## 6. Registre des traitements CNIL (RGPD Art. 30)

**Table** : `registre_traitement` (migration V9)

**Traitement documenté** : `DOSIMETRIE_NIR`
- **Finalité** : Suivi dosimétrique des travailleurs exposés aux rayonnements ionisants
- **Base légale** : Code du travail Art. L4451-1 et R4453-1 (obligation légale employeur)
- **Catégories de données** : NIR, nom, prénom, date de naissance, catégorie réglementaire, données dosimétriques
- **Durée de conservation** : Durée d'emploi + 10 ans (Code du travail R4453-23)
- **Destinataires** : PCR (Personne Compétente en Radioprotection) uniquement
- **Mesures de sécurité** : Chiffrement AES-256 SQLCipher, accès authentifié, journal_acces

## 7. Contrôle d'accès

**Authentification requise** : Toutes les commandes Tauri exposant les données métier (travailleur, appareil, etc.) vérifient `ensure_authenticated()` avant accès à la base de données

**Retour d'erreur immédiat** : Si SessionState.authenticated == false, pas d'accès DB

**Commandes sans authentification** (publiques) :
- `session_check` : vérification de l'état de session
- `iphone_network_available` : détection réseau local
- `iphone_has_paired_device` : vérification pairing
- `ping` : health check
- `bluetooth_check` : vérification connectivité

## 8. Isolation réseau

- Frontend servi localement via `http://127.0.0.1:1420` (tauri-plugin-localhost)
- Aucune donnée transmise vers serveur externe
- Serveur HTTP d'authentification iPhone : temporaire, ouvert uniquement pendant la fenêtre de challenge (60–300 secondes)
- Serveur HTTP : accès réseau local uniquement (0.0.0.0:port, accepte connexion iPhone sur LAN)

## 9. Dépendances de sécurité

| Crate | Version | Rôle |
|-------|---------|------|
| rusqlite | 0.31 | SQLCipher AES-256 |
| p256 | 0.13 | ECDSA P-256 cryptographie |
| aes-gcm | 0.10 | Chiffrement (support futur) |
| argon2 | 0.5 | Dérivation de clé (support futur) |
| keyring | 2 | Stockage clé OS (Credential Manager / Keychain) |
| base64 | 0.22 | Encodage QR payload |
| sha2 | 0.10 | Hachage SHA-256 (Secure Enclave) |

## 10. Limitations connues et recommandations

**Application monoposte** : Un seul opérateur (le PCR) par installation, pas de gestion multi-utilisateurs.

**Portabilité du trousseau** : Le fichier `pcr.db` chiffré peut être copié, mais la clé AES-256 reste dans le trousseau OS du poste. La clé ne traverse pas le poste.

**Recommandation de sauvegarde** : Exporter la clé du trousseau ou utiliser une fonction d'export chiffré de l'application pour une récupération d'urgence.

**Journal non réplicable** : Le `journal_acces` est local, non transmis. Conserver les sauvegardes si audit trail persistant est requis.

**Threat model** : Protection contre l'accès non autorisé au poste de travail ; pas de protection contre un administrateur local qui aurait accès au trousseau ou au fichier DB brut.
