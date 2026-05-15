# Cahier des Charges — Application de Suivi Radioprotection
**Version** : 2.0  
**Mise à jour** : Mai 2026  
**Changements v2** : Architecture pivot vers client lourd Tauri (desktop local), authentification Passkey, stockage SQLite chiffré.

---

## 1. Contexte et Vision

### Besoin métier
L'application doit centraliser en un seul endroit :
- Le suivi des travailleurs et leurs habilitations
- Le suivi des appareils radiologiques
- Les échéances réglementaires
- Les contrôles techniques et contrôles qualité
- Les documents administratifs

### Principes de conception
- **Simple** et intuitive
- **Visuelle** avec codes couleur clairs
- **Rapide** à utiliser au quotidien
- **Orientée métier** (cardiologie interventionnelle)
- **Sans complexité technique inutile**

### Fonctionnalités clés
- Fiches détaillées et modulables
- Statuts calculés automatiquement
- Alertes intelligentes basées sur les échéances
- Navigation par modules thématiques
- Tableau de bord de synthèse

---

## 2. Architecture Générale

### Navigation principale
Barre supérieure avec 5 modules :

1. **Tableau de bord** — Vue globale et alertes
2. **Établissement** — Informations administratives
3. **Travailleurs** — Gestion du personnel
4. **Appareils** — Gestion des équipements
5. **Actions** — Suivi des tâches réglementaires

---

## 3. Module Tableau de Bord

### Objectif
Afficher une vue d'ensemble des échéances et anomalies avec accès rapide aux fiches concernées.

### Affichage
- **Cartes visuelles** avec statuts synthétiques
- **Couleurs dynamiques** pour urgence visuelle
- **Sources des alertes** identifiées par catégorie

### Sources d'alerte
| Source | Description |
|--------|-------------|
| Habilitations travailleurs | Formation, compétences appareils, visites médicales |
| Visites médicales | Renouvellements périodiques |
| Formations | Radioprotection (3 ans), patients (7 ans) |
| Vérifications techniques | Annuelles et triennales |
| Contrôles qualité | Externes et internes |

### Statuts affichés
- **En retard** (rouge)
- **À prévoir** (orange)
- **À jour** (vert)

---

## 4. Module Établissement

### Objectif
Centraliser les informations administratives et documents clés.
L'application supporte **plusieurs établissements** gérés par un même utilisateur.

### Informations administratives

#### Identification
- Dénomination / raison sociale
- Statut juridique
- Numéro SIRET (champ large, 14 chiffres)

#### Adresse
- Adresse
- Code postal
- Ville

#### Coordonnées
- Téléphone
- Adresse mail
- Site internet (optionnel)

### Gestion du K-Bis

#### Interface
Deux lignes distinctes :

| Élément | Description |
|---------|-------------|
| **Ligne SIRET** | Champ de saisie : 14 chiffres |
| **Ligne K-Bis** | Nom fichier chargé + boutons *Charger / Remplacer* et *Ouvrir* |

#### Fonctionnalités
- Charger un document PDF (stocké dans le répertoire de données local de l'application)
- Remplacer le document existant
- Ouvrir le document dans le visualiseur natif du système

---

## 5. Module Travailleurs

### Objectif
Gérer les travailleurs soumis au suivi radioprotection avec traçabilité complète.

### Tableau principal

#### Colonnes affichées
| Colonne | Type |
|---------|------|
| Nom | Texte |
| Prénom | Texte |
| Fonction | Liste déroulante |
| Habilitation | Statut calculé |

#### Fonctions disponibles
- Ajouter un travailleur
- Modifier un travailleur
- Ouvrir une fiche détaillée

---

### Fiche Travailleur — Structure

La fiche est organisée en **2 onglets** :
1. **Données personnelles**
2. **Habilitation**

---

#### Onglet 1 : Données Personnelles

##### Identité
- Nom
- Prénom
- Sexe
- Date de naissance
- Lieu de naissance
- Pays de naissance

##### Activité professionnelle
- **Fonction** (liste : Cardiologue / Cardiologue libéral / MERM / Infirmier)
- Date de début d'activité
- Catégorie réglementaire (A / B)
- Numéro ADELI/RPPS

##### Coordonnées
- Adresse mail
- Numéro de téléphone

##### Suivi réglementaire
- Numéro sécurité sociale
- Numéro porteur dosimétrie passive
- Numéro suivi médical

---

#### Onglet 2 : Habilitation

##### Principe
L'**habilitation** est un statut synthétique calculé automatiquement selon :
- Les formations suivies
- Les inscriptions dosimétriques
- Les compétences appareils validées
- Le statut de la visite médicale

##### Statuts possibles
- **Non validée** (gris) — Manque au moins un élément
- **Partielle** (orange) — Certains critères validés
- **Validée** (vert) — Tous les critères remplis

---

##### Items d'habilitation

###### 1. Dosimétrie passive
- Date de validation
- Alerte de renouvellement

###### 2. Dosimétrie opérationnelle
- Date de validation
- Alerte de renouvellement

###### 3. Formation Radioprotection Travailleurs
- Date de validation
- **Renouvellement** : tous les 3 ans

###### 4. Formation Radioprotection Patients
- Date de validation
- **Renouvellement** : tous les 7 ans

###### 5. Formation Utilisation des Appareils
- Ouvre une **sous-fiche compétences appareils**
- Validation individuelle par appareil
- Impacte le statut de formation

---

### Sous-fiche : Compétences Appareils

#### Objectif
Valider individuellement les compétences techniques sur chaque appareil.

#### Compétences à valider (9 au total)
- Mise sous tension de l'appareil
- Mise en marche de l'appareil
- Enregistrement patient (après vérification identité)
- Détection patients à risque
- *(... + 5 autres à définir avec le métier)*

#### Statut de formation appareils
| Statut | Critère | Couleur |
|--------|---------|--------|
| Aucune compétence | 0/9 validées | Gris |
| Validation partielle | 1-8/9 validées | Orange |
| Validation complète | 9/9 validées | Vert |

---

### Visite Médicale

#### Règles
- Une visite médicale doit être à jour pour valider l'habilitation
- Une visite expirée fait basculer l'habilitation à *non validée*

---

## 6. Module Appareils

### Objectif
Gérer les appareils radiologiques et leurs contrôles périodiques réglementaires.

### Tableau principal

#### Colonnes affichées
| Colonne | Type |
|---------|------|
| Désignation | Texte |
| Numéro de série | Texte |
| Lieu | Texte |
| Vérification technique | Statut |
| Contrôle qualité | Statut |

---

### Statuts Visuels

| Statut | Couleur | Condition |
|--------|---------|-----------|
| Valide | Vert | Échéance éloignée |
| À prévoir | Orange | Dans 3 mois avant échéance |
| Invalide | Rouge | Échéance dépassée |

---

### Fiche Appareil

#### Section 1 : Informations Générales
- Marque
- Modèle
- Numéro de série
- Type : Fixe / Déplaçable
- Année de mise en service
- Lieu d'utilisation
- Utilisation partagée : Oui / Non

#### Section 2 : Caractéristiques Techniques
- Tension nominale (kV)
- Intensité maximale (mA)

---

### Vérification Technique

#### Deux sous-parts

##### 1. Vérification annuelle interne
- **Réalisée par** : PCR ou organisme agréé
- **Échéance** : 1 an
- **Alerte** : 1 mois avant

##### 2. Vérification triennale externe
- **Réalisée par** : Organisme agréé uniquement
- **Échéance** : 3 ans
- **Alerte** : 1 mois avant

#### Logique de statut
Le statut affiché est calculé selon **la plus contraignante des échéances**.

---

### Contrôle Qualité

#### Deux catégories

##### 1. Contrôle qualité externe
- Point de départ du cycle complet
- Génère automatiquement les contrôles internes

##### 2. Contrôles qualité internes

###### Contrôle partiel interne
- **Fréquence** : À 3 mois ET à 9 mois (après CQ externe)
- **Alerte** : 1 mois avant chaque échéance

###### Contrôle complet interne
- **Fréquence** : À 6 mois (après CQ externe)
- **Alerte** : 3 mois avant

---

## 7. Module Actions

### Objectif
Lister et suivre toutes les actions réglementaires à effectuer, indépendamment de leur source.

### Filtres disponibles
- Tout
- En retard
- À venir (dans 3 mois)
- Formation
- Contrôle (technique/qualité)
- Visite médicale

---

## 8. Règles Générales

### Codes couleur
| Couleur | Signification |
|---------|---------------|
| Vert | Valide / À jour |
| Orange | À prévoir / Attention |
| Rouge | Invalide / En retard |
| Gris | Non applicable / Non validé |

---

## 9. Architecture Technique

### Type d'application
**Client lourd desktop** — application native installée sur le poste de l'utilisateur.  
Aucun serveur, aucun hébergement externe. Les données restent localement sur la machine.

### Plateformes cibles
- Windows (`.exe` / installeur NSIS)
- macOS (`.dmg`)

> La compilation macOS nécessite un runner macOS (GitHub Actions ou machine Apple).

### Stack technique

#### Shell applicatif
- **Tauri 2** — framework Rust pour applications desktop cross-platform
- Fenêtre native, webview système (WebKit / WebView2)

#### Frontend (interface utilisateur)
- **React 18** + **TypeScript**
- **Tailwind CSS** — styling utilitaire
- **React Router** — navigation entre modules
- **TanStack Query** — gestion état serveur / cache local

#### Commandes Tauri (backend local)
- **Rust** — handlers de commandes Tauri (`invoke`)
- Accès base de données, système de fichiers, ouverture de fichiers natifs

#### Base de données
- **SQLite** via `rusqlite` (crate Rust)
- **SQLCipher** — chiffrement AES-256 de la base de données au repos
- Fichier unique `.db` dans le répertoire de données de l'application (`AppData` / `Application Support`)
- Migrations versionnées (`refinery` ou `rusqlite_migration`)

#### Authentification
- **WebAuthn / Passkey** — authentification sans mot de passe
- Biométrie ou PIN système (Face ID, Windows Hello, empreinte)
- Credential stockée localement, non transmise sur réseau
- Implémentation : `webauthn-rs` (crate Rust) côté vérification

#### Stockage fichiers (PDFs, documents)
- Répertoire dédié dans `AppData` / `Application Support`
- Chemin relatif stocké en base, ouverture via `tauri::api::shell::open`

### Sécurité des données
| Menace | Mitigation |
|--------|------------|
| Accès non autorisé à l'app | Passkey (WebAuthn) |
| Lecture du fichier `.db` | SQLCipher (AES-256) |
| Fuite réseau | Aucune connexion réseau (local only) |
| Perte de données | Sauvegardes manuelles ou export chiffré (Phase 2) |

### Conformité RGPD
Les données (dont NSS) restent sur le poste professionnel du responsable de traitement lui-même.  
Pas d'obligation HDS dans ce contexte (pas d'hébergement tiers).  
La conformité RGPD incombe au professionnel en tant que responsable de traitement.

---

## 10. Fonctionnalités Futures (Phase 2+)

- [ ] Export PDF des fiches et rapports
- [ ] Sauvegarde chiffrée exportable (`.zip` AES)
- [ ] Historique complet des modifications (audit trail)
- [ ] Notifications système (alertes OS natives)
- [ ] Gestion documentaire intégrée
- [ ] Journal d'audit réglementaire (ASN)
- [ ] Gestion des dosimètres personnels
- [ ] Statistiques conformité établissement
- [ ] Rapports régulateurs (ASN, etc.)
- [ ] Import / synchronisation entre postes (chiffré)

---

## 11. Notes et Considérations

### Données sensibles
- Numéros de sécurité sociale → chiffrés dans SQLCipher
- Données dosimétriques et médicales → idem
- Documents PDF réglementaires → stockés localement hors base

### Utilisateurs
- **Utilisateur unique** : le responsable radioprotection (PCR)
- Authentification Passkey (biométrie / PIN) à chaque ouverture
- Support multi-établissements dans la même application
