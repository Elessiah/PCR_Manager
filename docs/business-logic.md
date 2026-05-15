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

Ces durées sont codifiées dans `src-tauri/src/commands/habilitation.rs` (durations de validation) et `schema.sql` (calculs de dates pour les vérifications techniques).

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
