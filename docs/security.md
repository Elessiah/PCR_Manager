# Sécurité

Ce document décrit les principes, mécanismes et bonnes pratiques de sécurité mis en place dans PCR Manager pour protéger les données sensibles de radioprotection.

## Principes

PCR Manager est une application entièrement locale, sans transmission réseau. Les données utilisateur ne quittent jamais le poste de travail. L'accès à l'application est contrôlé par authentification Passkey WebAuthn (biométrie ou PIN système), et la base de données est chiffrée au repos en AES-256 via SQLCipher. Chaque couche de protection s'appuie sur des primitives cryptographiques éprouvées et des mécanismes du système d'exploitation.

## Modèle de menace

| Menace | Mitigation |
|--------|-----------|
| Accès non autorisé à l'application | Passkey WebAuthn avec biométrie ou PIN système |
| Lecture du fichier `.db` en cas d'accès physique au disque | Chiffrement AES-256 via SQLCipher |
| Fuite réseau ou interception des données | Application purement locale, aucune connectivité réseau |
| Perte de données utilisateur | Sauvegardes manuelles du répertoire AppData ou export chiffré (Phase 2) |

## Authentification — Passkey WebAuthn

PCR Manager utilise la crate `webauthn-rs` version 0.5 (feature `danger-allow-state-serialisation`) pour l'implémentation côté serveur Tauri des flows WebAuthn standard.

### Flow d'enregistrement

L'enregistrement d'une Passkey suit deux étapes :

1. **Démarrage** : la commande `passkey_register_start` génère un défi (UUID utilisateur aléatoire) et retourne une `CreationChallengeResponse` que l'authenticateur traite.
2. **Finition** : la commande `passkey_register_finish` reçoit la réponse signée de l'authenticateur, vérifie la signature via `finish_passkey_registration`, et persiste le credential sérialisé en JSON dans la table `passkey` (colonnes : `credential_id`, `public_key`, `sign_count`, `label`, `created_at`).

L'état intermédiaire d'enregistrement (défis non consommés) est conservé en mémoire dans une `HashMap<String, PasskeyRegistration>` indexée par UUID (`reg_id`), valide pour une seule tentative. Cette sérialisation en mémoire (feature `danger-allow-state-serialisation`) est acceptable car l'état est volatil et consommé rapidement.

### Flow d'authentification

L'authentification se déroule en deux temps :

1. **Démarrage** : la commande `passkey_auth_start` charge tous les credentials de la table `passkey`, les désérialise, et invoque `start_passkey_authentication` pour générer un défi multi-credential.
2. **Finition** : la commande `passkey_auth_finish` reçoit la réponse signée, la vérifie via `finish_passkey_authentication`, et met à jour le `sign_count` et le timestamp `last_used_at` du credential utilisé.

L'état intermédiaire d'authentification est conservé en mémoire dans une `HashMap<String, PasskeyAuthentication>` indexée par UUID (`auth_id`), valide pour une seule tentative.

## Chiffrement de la base

La base SQLite est chiffrée au repos en AES-256 via SQLCipher (crate `rusqlite` 0.31, feature `bundled-sqlcipher-vendored-openssl`). SQLCipher fournit un chiffrement transparent : toutes les pages du fichier `.db` sont chiffrées et déchiffrées automatiquement. À chaque ouverture de la base de données, la clé est appliquée immédiatement via `PRAGMA key` avant d'accéder à toute table, sans intervention de l'utilisateur.

**Dérivation de la clé** : actuellement en phase de développement, la clé est statique. En production, elle devra être dérivée de manière sécurisée (voir section Bonnes pratiques opérationnelles).

## Stockage des fichiers

- **Base de données** : fichier `pcr.db` dans le répertoire de données de l'application (`app_local_data_dir()` déterminé via la crate `directories`), typiquement `%APPDATA%/PCR Manager/` sous Windows ou `~/Library/Application Support/PCR Manager/` sous macOS.
- **Documents** (K-Bis, PDFs) : stockés dans un sous-dossier `documents/` du même répertoire. La base de données conserve uniquement le chemin relatif de chaque document.

## Surface IPC

L'application expose les commandes Tauri suivantes à la couche frontend :

- `passkey_register_start` : initie un enregistrement de Passkey
- `passkey_register_finish` : complète un enregistrement
- `passkey_auth_start` : initie une authentification
- `passkey_auth_finish` : complète une authentification
- `init_db` : exécute les migrations de base de données

Les paramètres et réponses de ces commandes sont validés par `webauthn-rs` avant d'être traités. Aucun port réseau n'est ouvert. La communication inter-processus se limite à l'appel de commandes Tauri depuis le webview vers le backend Rust, sans exposition à la surface d'attaque réseau. Pour une documentation complète des commandes, consulter [backend.md](./backend.md).

## RGPD

Les données utilisateur (dont numéros de sécurité sociale, données dosimétriques, informations médicales) restent exclusivement sur le poste de travail de l'administrateur radioprotection. Aucun transfert vers un serveur tiers, aucun hébergement déporté. Aucune obligation HDS (Hébergement de Données de Santé) n'est applicable. La conformité RGPD incombe au responsable de traitement (utilisateur de l'application) en tant que contrôleur unique. La suppression des données s'effectue par suppression du fichier `pcr.db` et du dossier `documents/`.

## Bonnes pratiques opérationnelles

- **Sauvegardes** : effectuer régulièrement des sauvegardes manuelles du répertoire `%APPDATA%/PCR Manager/` (ou équivalent macOS) sur un support externe chiffré. Les sauvegardes doivent être stockées de manière sécurisée et chiffrée.
- **Mise à jour du système** : maintenir le système d'exploitation à jour pour bénéficier des derniers patches de sécurité et des mises à jour de l'authenticateur biométrique.
- **Perte de la Passkey** : en l'absence de mécanisme de récupération, la perte de la clé biométrique ou de l'authenticateur matériel rend la base inaccessible. Planifier une gestion des authenticateurs de secours au déploiement.
- **Clé de chiffrement DB** : en production, la clé de chiffrement doit être dérivée d'un secret utilisateur robuste (par ex. via PBKDF2 ou Argon2 à partir d'un mot de passe maître ou de la Passkey elle-même) et jamais en dur dans le code.

## Limitation et considérations futures

En phase 2, un mécanisme de récupération d'accès (recovery codes, second authenticateur) et une dérivation de clé robuste seront implémentés pour renforcer la sécurité opérationnelle.

## Liens

- [backend.md](./backend.md) — Liste des commandes Tauri et their signatures
- [database.md](./database.md) — Schéma de base de données et migrations
