# Brief patch visuel v2 — Écarts maquette vs application

Repo : `C:\work\PCR Manager\.claude\worktrees\nice-elbakyan-8c32df`
Fichiers à modifier : exactement ceux listés par écart, pas d'autres.

---

## ÉCART 1 — KpiTile : valeur colorée + chip badge top-right

**Fichier** : `src/components/ui/KpiTile.tsx`

**Maquette** : chaque tuile a :
- La valeur numérique colorée selon le ton (rouge pour "En retard", orange pour "À prévoir", vert pour "À jour")
- Un petit badge chip en haut à droite (ex: "△ 13 actions" en rouge, "⏱ 90 jours" en orange, "✓ Conforme" en vert)

**Actuel** : valeur toujours noire (`text-3xl font-bold mono`), aucun chip.

**Spec** : ajouter deux props optionnelles :
- `tone?: 'danger' | 'warn' | 'ok'` — colore la valeur : danger → `var(--danger)`, warn → `var(--warn)`, ok → `var(--ok)`
- `chip?: React.ReactNode` — affiché en haut à droite dans un `Badge` avec le même variant que `tone`

Le composant doit rester **rétrocompatible** (si pas de tone/chip, comportement actuel inchangé).

---

## ÉCART 2 — Dashboard : 4 corrections visuelles

**Fichier** : `src/modules/dashboard/Dashboard.tsx`

### 2a — KPI tiles : passer tone + chip + fix calcul "À jour"

Les 3 `<KpiTile>` doivent recevoir `tone` et `chip` (après la fix de KpiTile.tsx) :
```tsx
<KpiTile label="EN RETARD" value={kpiInRetard} tone="danger"
  chip={<><AlertTriangle size={12}/> {kpiInRetard} action{kpiInRetard > 1 ? 's' : ''}</>}
  footer="Échéances réglementaires dépassées" />

<KpiTile label="À PRÉVOIR" value={kpiAPrevoir} tone="warn"
  chip={<><Clock size={12}/> 90 jours</>}
  footer="Échéances dans les 3 mois" />

<KpiTile label="À JOUR" value={`${habilitationsStats.validee + habilitationsStats.partielle}/${travailleurs.length}`}
  tone="ok"
  chip={<><CheckCircle size={12}/> Conforme</>}
  footer="Travailleurs avec habilitation valide ou partielle" />
```

Le calcul actuel de "À jour" `travailleurs.length/travailleurs.length` est faux — il doit être `(validee + partielle) / total`.

### 2b — Échéances prioritaires : SUJET avec sous-titre + TYPE en texte coloré + STATUT avec icône

**SUJET** : ajouter `action.libelle` comme sous-titre en gris sous `action.cible.label` :
```tsx
<TD>
  <div className="font-medium text-sm">{action.cible.label}</div>
  <div className="text-xs text-textMuted mt-0.5">{action.libelle}</div>
</TD>
```

**TYPE** : la maquette montre du texte en couleur accent (bleu) sans badge. Remplacer `<Badge variant="neutral">` par :
```tsx
<TD className="text-accent text-sm font-medium">
  {action.categorie === 'verification' ? 'Vérification' : 'Contrôle'}
</TD>
```

**STATUT** : ajouter une icône dans le badge. Utiliser les icônes lucide-react déjà importées :
- `en_retard` → `<AlertTriangle size={12}/>` + variant="danger" + label "Invalide"
- `a_prevoir` → `<Clock size={12}/>` + variant="warn" + label "À prévoir"
- `valide` → `<CheckCircle size={12}/>` + variant="ok" + label "À jour"

```tsx
<TD>
  {status === 'en_retard' && <Badge variant="danger" icon={<AlertTriangle size={12}/>}>Invalide</Badge>}
  {status === 'a_prevoir' && <Badge variant="warn" icon={<Clock size={12}/>}>À prévoir</Badge>}
  {status === 'valide' && <Badge variant="ok" icon={<CheckCircle size={12}/>}>À jour</Badge>}
</TD>
```

### 2c — Sources des alertes : masquer les zéros, afficher "À jour" si tout est 0

Actuellement les badges `<Badge variant="danger">0</Badge>` s'affichent même quand count=0. La maquette ne montre que les counts non nuls, et si tous sont 0 → un seul badge vert "À jour".

Règle : pour chaque catégorie, n'afficher un Badge que si son count > 0. Si danger=0, warn=0, ok=0 → afficher `<Badge variant="ok"><CheckCircle size={12}/> À jour</Badge>`.

---

## ÉCART 3 — Sidebar : labels de section + box établissement + sous-titre brand

**Fichier** : `src/components/layout/Sidebar.tsx`

### 3a — Sous-titre brand
Sous "Gestionnaire PCR", ajouter en petit gris : "Suivi radioprotection"
```tsx
<div>
  <h1 className="text-base font-semibold text-text leading-tight">Gestionnaire PCR</h1>
  <p className="text-xs text-textMuted">Suivi radioprotection</p>
</div>
```

### 3b — Label de section "NAVIGATION" avant la nav
```tsx
<div className="text-xs font-semibold text-textSoft uppercase tracking-widest mb-2 px-2.5">
  Navigation
</div>
```

### 3c — Label "ÉTABLISSEMENT" + box grise autour des infos établissement
La section établissement actuelle affiche denomination/ville/SIRET sans fond. La maquette a une box `bg-surface-2 rounded-lg p-3` avec un label "ÉTABLISSEMENT" au-dessus :

```tsx
{/* Section établissement */}
<div className="py-3">
  <div className="text-xs font-semibold text-textSoft uppercase tracking-widest mb-2 px-0.5">
    Établissement
  </div>
  <div className="bg-surface2 rounded-lg p-3 border border-border">
    <div className="text-sm font-medium text-text leading-snug">
      {etablissement?.denomination || '—'}
    </div>
    <div className="text-xs text-textMuted mt-1">
      {etablissement?.ville || '—'}
    </div>
    <div className="text-xs font-mono text-textMuted mt-1">
      SIRET {etablissement?.siret || '—'}
    </div>
  </div>
</div>
```

Note : la classe Tailwind pour `--surface-2` s'appelle `bg-surface2` ou `bg-surfaceTwo` selon le tailwind.config.ts — **lire le fichier `tailwind.config.ts` avant d'éditer** pour utiliser le bon nom de classe.

---

## Contraintes globales

1. **Lire chaque fichier AVANT d'éditer** (`package.json`, `tailwind.config.ts`, fichiers cibles)
2. **Ne pas modifier** les autres composants UI atomiques sauf `KpiTile.tsx`
3. **Mettre à jour les tests** correspondants pour les nouvelles props/classes
4. **Valider** avec `npm run test:run` après chaque fichier
5. **Committer** après validation (pas de Co-Authored-By)
