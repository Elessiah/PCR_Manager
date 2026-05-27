# Règles métier — PCR Manager

## Statuts couleur

Le système utilise quatre états pour visualiser l'imminence des tâches de suivi radioprotection :

- **Vert** (`valide`) : délai non atteint
- **Orange** (`a_prevoir`) : délai atteint (action requise dans le délai d'alerte)
- **Rouge** (`en_retard`) : délai dépassé
- **Gris** (`non_applicable`) : pas de date ou information manquante

Le statut est déterminé par la fonction `statusFromDate` via la comparaison entre une date d'échéance et le jour courant :

```ts
export function statusFromDate(
  deadlineIso: string | null | undefined,
  alertMonths: number = 1
): StatusColor {
  if (!deadlineIso) return 'non_applicable';

  const now = new Date();
  const deadline = new Date(deadlineIso);

  if (Number.isNaN(deadline.getTime())) return 'non_applicable';

  if (deadline < now) return 'en_retard';

  const alertThreshold = new Date(now);
  alertThreshold.setMonth(alertThreshold.getMonth() + alertMonths);

  if (deadline <= alertThreshold) return 'a_prevoir';

  return 'valide';
}
```

**Seuil d'alerte par défaut** : `alertMonths = 1` (1 mois avant l'échéance). Certains appels personnalisent ce seuil (ex : 3 mois pour les contrôles qualité complets).

## Habilitation

L'habilitation d'un travailleur est calculée côté Rust par la commande `habilitation_compute()`, qui évalue quatre critères et retourne un statut global :

```rust
pub async fn habilitation_compute(
  travailleur_id: i64, 
  state: tauri::State<'_, DbState>
) -> Result<HabilitationStatus, String>
```

**Trois statuts possibles** :
- `validee` : tous les critères sont satisfaits
- `partielle` : au moins un critère est satisfait (mais pas tous)
- `non_validee` : aucun critère n'est satisfait

**Quatre critères d'habilitation** :

1. **Formation RP Travailleurs** (`formation_rp_ok`) : date de formation ≤ 3 ans
2. **Dosimétrie** (`dosimetries_ok`) : au moins une dosimétrie passive renseignée
3. **Compétences appareils** (`competences_ok`) : au moins un appareil avec 9/9 compétences validées
4. **Visite médicale** (`visite_med_ok`) : date de visite médicale ≤ 1 an

Calcul du statut :

```rust
let statut = if formation_rp_ok && dosimetries_ok && competences_ok && visite_med_ok {
    "validee".to_string()
} else if (formation_rp_ok as i32) + (dosimetries_ok as i32) 
         + (competences_ok as i32) + (visite_med_ok as i32) > 0 {
    "partielle".to_string()
} else {
    "non_validee".to_string()
};
```

## Renouvellements

| Élément | Périodicité |
|--------|------------|
| Formation RP Travailleurs | 3 ans |
| Formation RP Patients | 7 ans |
| Vérification annuelle interne | 1 an |
| Vérification triennale externe | 3 ans |

Ces durées sont codifiées dans `src-tauri/src/commands/habilitation.rs` (durations de validation) et `db/schema.sql` (calculs de dates pour les vérifications techniques).

## Page Actions — Agrégation des échéances réglementaires

La page `/actions` (`src/modules/actions/Actions.tsx`) collecte toutes les échéances réglementaires de l'application en une liste unifiée et triée, quel que soit le domaine source (travailleur ou appareil).

### Sources de données et calcul des échéances

**Par travailleur** (via `api.habilitation.getForTravailleur`) — 5 items générés par travailleur, même si la date est absente :

| Item | Champ source | Calcul de l'échéance |
|------|-------------|----------------------|
| Dosimétrie passive | `dosimetrie_passive_date` | date + 2 ans |
| Dosimétrie opérationnelle | `dosimetrie_operationnelle_date` | date + 2 ans |
| Formation RP travailleurs | `formation_rp_travailleurs_date` | date + 3 ans |
| Formation RP patients | `formation_rp_patients_date` | date + 7 ans |
| Visite médicale | `visite_medicale_date_peremption` (prioritaire) sinon `visite_medicale_date + durée_mois` sinon `visite_medicale_date + 1 an` | voir colonne gauche |

Si la date source est absente (`null`), l'item est généré avec `deadline: null` → statut **Non renseigné**.

**Par appareil** (via `api.verification.list`) — vérifications techniques, seule la plus récente par type est retenue :

| Item | Type | Calcul de l'échéance |
|------|------|----------------------|
| Vérification annuelle | `annuelle_interne` | date_realisation + 1 an |
| Vérification triennale | `triennale_externe` | date_realisation + 3 ans |

Si aucune vérification d'un type donné n'existe pour un appareil, un item **Non renseigné** est généré (`deadline: null`).

**Par appareil** (via `api.controleQualite.list`) — contrôles qualité :

Tous les CQ dont `statut !== 'realise'` sont inclus directement avec leur `date_echeance`. Les CQ marqués `realise` sont ignorés.

### Statut des items

Le statut de chaque item est calculé par `statusFromDate(deadline, alertMonths = 3)` avec un seuil d'alerte uniforme de **3 mois** pour tous les types (y compris la dosimétrie et les formations, même si leur onglet Habilitation utilise 1 mois).

| Valeur `deadline` | Statut retourné |
|-------------------|----------------|
| `null` | `non_applicable` → **Non renseigné** |
| date dépassée | `en_retard` → **En retard** |
| date dans ≤ 3 mois | `a_prevoir` → **À prévoir** |
| date dans > 3 mois | `valide` → non affiché |

> Les items **Valide** ne sont **jamais affichés** dans la page Actions : ils ne nécessitent pas d'action immédiate.

### Ordre de tri

Les items sont triés dans l'ordre suivant :

1. **Groupe** : En retard (0) → À prévoir (1) → Non renseigné (2)
2. **Deadline** croissante dans chaque groupe (la plus ancienne / la plus proche en premier). Les items sans deadline (`null`) se classent en dernier via le substitut `'9999-99-99'`.
3. **Label** alphabétique (locale `fr`) en cas d'égalité de deadline.

### Filtres disponibles

| Filtre | Critère |
|--------|---------|
| Tout | Tous les items affichés |
| En retard | `statusFromDate(deadline, 3) === 'en_retard'` |
| À venir | `statusFromDate(deadline, 3) === 'a_prevoir'` |
| Non renseigné | `statusFromDate(deadline, 3) === 'non_applicable'` |
| Formation | `categorie === 'formation'` |
| Contrôle | `categorie === 'controle'` |
| Visite méd. | `categorie === 'visite_med'` |
| Dosimétrie | `categorie === 'dosimetrie'` |

Les filtres de catégorie incluent les items Non renseigné de la catégorie concernée.

### Navigation

Un clic sur une ligne navigue vers la fiche de l'entité correspondante :
- `cible.type === 'travailleur'` → `/travailleurs/:id`
- `cible.type === 'appareil'` → `/appareils/:id`

### Badge récapitulatif dans TravailleurFiche

La fiche d'un travailleur (`/travailleurs/:id`) affiche un badge d'habilitation global dans l'en-tête. Ce badge utilise la même logique frontend que la page Actions : `computeHabBadgeFromRaw` calcule le pire statut parmi les 5 items d'habilitation via `statusFromDate`. Il partage le cache React Query `['habilitationRaw', travailleurId]` avec l'onglet Habilitation, ce qui garantit un rafraîchissement immédiat après toute modification.

> **Différence avec `habilitation_compute` (backend)** : le badge frontend utilise des dates précises et des seuils d'alerte (alertMonths = 1 dans l'onglet, identique au format d'affichage par item), tandis que `habilitation_compute` applique une logique binaire (≤ N ans, présence/absence). Les deux systèmes coexistent : le backend pour la validation réglementaire formelle, le frontend pour l'affichage des urgences.

---

## Contrôles qualité — génération automatique

À l'insertion d'un contrôle qualité externe, un trigger SQL génère automatiquement trois contrôles qualité internes aux jalons J+90, J+180 et J+270 :

```sql
CREATE TRIGGER IF NOT EXISTS trg_generer_cq_internes
    AFTER INSERT ON controle_qualite
    WHEN NEW.type = 'externe'
    BEGIN
        -- Contrôle partiel à 3 mois (J+90)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+3 months'), NEW.id, 'planifie');

        -- Contrôle complet à 6 mois (J+180)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'complet_interne',
             date(NEW.date_echeance, '+6 months'), NEW.id, 'planifie');

        -- Contrôle partiel à 9 mois (J+270)
        INSERT INTO controle_qualite
            (appareil_id, type, date_echeance, controle_externe_id, statut)
        VALUES
            (NEW.appareil_id, 'partiel_interne',
             date(NEW.date_echeance, '+9 months'), NEW.id, 'planifie');
    END;
```

Les trois contrôles internes sont créés automatiquement dans l'état `planifie` et chaînés au contrôle externe parent via `controle_externe_id`.

## Compétences appareils

Le système valide les compétences des travailleurs sur chaque appareil. Neuf compétences fixes, seedées au déploiement :

1. Mise sous tension de l'appareil
2. Mise en marche de l'appareil
3. Enregistrement patient (vérification identité)
4. Détection patients à risque
5. Compétence 5
6. Compétence 6
7. Compétence 7
8. Compétence 8
9. Compétence 9

**Validation** : chaque compétence est validée individuellement pour le couple (travailleur, appareil) via la table `competence_travailleur`. Un travailleur est considéré **compétent** sur un appareil quand **toutes 9 compétences** sont marquées `validated = 1`.

## Liens

- [database.md](./database.md) — schéma complet, triggers et vues
- [backend.md](./backend.md) — commandes Tauri, logique de calcul
- [security.md](./security.md) — gestion des données sensibles et chiffrement
