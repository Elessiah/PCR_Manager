# PCR Manager — Application de Suivi Radioprotection

**Version**: 2.0  
**Dernière mise à jour**: Mai 2026  
**Statut**: Initialisation du dépôt

---

## 📋 Vue d'ensemble

PCR Manager est une **application desktop locale** pour centraliser la gestion radioprotection en cardiologie interventionnelle:

- ✅ Suivi des travailleurs et habilitations
- ✅ Gestion des appareils radiologiques
- ✅ Contrôles techniques et qualité
- ✅ Échéances réglementaires automatisées
- ✅ Alertes intelligentes

**Architecture**: Client lourd Tauri (Rust) + React (TypeScript)  
**Données**: SQLite chiffré (AES-256 / SQLCipher), zéro réseau

---

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| **Shell applicatif** | Tauri 2 (Rust) |
| **Frontend** | React 18 + TypeScript + Tailwind CSS |
| **Base de données** | SQLite + SQLCipher |
| **Authentification** | WebAuthn / Passkey (biométrie, PIN) |
| **Plateforme** | Windows, macOS |

---

## 📦 Structure du projet

```
PCR Manager/
├── db/schema.sql                                 # Modèle de données
├── docs/cahier_des_charges_radioprotection_v2.md # Spécifications fonctionnelles
├── .gitignore                                    # Exclusions Git
├── README.md                                     # Ce fichier
└── src-tauri/                                    # (À créer) Application Tauri
    ├── src/                                      # Code Rust
    ├── Cargo.toml                                # Dépendances Rust
    └── ...
```

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js** 18+ et npm/yarn
- **Rust** 1.70+ avec Cargo
- **Git** 2.30+

### Installation (à venir)

```bash
# 1. Clone et dépendances
npm install
cargo build

# 2. Démarrage en mode développement
npm run tauri dev

# 3. Build de production
npm run tauri build
```

---

## 📝 Modules

1. **Tableau de bord** — Vue d'ensemble des alertes et statuts
2. **Établissement** — Infos administratives, K-Bis, documents
3. **Travailleurs** — Gestion du personnel et habilitations
4. **Appareils** — Équipements, vérifications, contrôles qualité
5. **Actions** — Suivi des tâches réglementaires

---

## 🔐 Sécurité

- **Authentification**: Passkey (WebAuthn) — pas de mots de passe
- **Chiffrement BD**: SQLCipher AES-256
- **Données sensibles**: NSS et données médicales chiffrées
- **Conformité**: RGPD (responsable de traitement local)

---

## 📖 Documentation

Consulter le **cahier des charges** pour les détails:
- Spécifications fonctionnelles complètes
- Architecture détaillée
- Modèle de données (`db/schema.sql`)
- Fonctionnalités futures (Phase 2+)

---

## 📞 Contact

**Email**: kgalaxie84@gmail.com  
**Configuration locale**: PCR Manager

---

## 📅 Historique

- **v2.0** (Mai 2026): Migration Tauri, SQLCipher, Passkey, interface rénovée
- **v1.0**: Prototype initial

---

## ⚖️ Licence

À définir selon les politiques internes.
