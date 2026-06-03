import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { fonctionLabel } from '../../lib/labels';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { Plus, Search, ChevronRight } from 'lucide-react';

type HabilitationFilter = 'tous' | 'validee' | 'partielle' | 'non_validee';

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="inline-grid place-items-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `oklch(0.92 0.04 ${hue})`, color: `oklch(0.45 0.15 ${hue})`, fontSize: size * 0.4 }}
      data-testid={`avatar-${name}`}
    >{initials}</span>
  );
}

export default function TravailleursList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<HabilitationFilter>('tous');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowAdd(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
      staleTime: 60_000,
    })),
  });

  const habilitations = useMemo(() => {
    const map: Record<number, string> = {};
    travailleurs.forEach((t, i) => {
      map[t.id] = habilitationQueries[i]?.data?.statut ?? 'non_validee';
    });
    return map;
  }, [travailleurs, habilitationQueries]);

  const filters = [
    { value: 'tous' as const, label: 'Tous', count: travailleurs.length },
    { value: 'validee' as const, label: 'Validée', count: Object.values(habilitations).filter(v => v === 'validee').length },
    { value: 'partielle' as const, label: 'Partielle', count: Object.values(habilitations).filter(v => v === 'partielle').length },
    { value: 'non_validee' as const, label: 'Non validée', count: Object.values(habilitations).filter(v => v === 'non_validee').length },
  ];

  const filtered = useMemo(() => travailleurs.filter(t => {
    const matchSearch = !q || [t.nom, t.prenom, t.fonction].some(x => x?.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = filter === 'tous' || habilitations[t.id] === filter;
    return matchSearch && matchStatus;
  }), [travailleurs, q, filter, habilitations]);

  const habToVariant = (s: string) => s === 'validee' ? 'ok' : s === 'partielle' ? 'warn' : 'danger';
  const habToLabel = (s: string) => s === 'validee' ? 'Validée' : s === 'partielle' ? 'Partielle' : 'Non validée';

  return (
    <div className="space-y-4">
      <PageHead
        title="Travailleurs"
        sub={`${travailleurs.length} personnes suivies`}
        actions={<Button variant="primary" onClick={() => setShowAdd(true)} title="Ajouter un travailleur (CTRL+N)" className="inline-flex items-center gap-2"><Plus size={14}/> Ajouter un travailleur</Button>}
      />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface border border-border rounded px-2.5 py-1.5 w-[320px]">
          <Search size={14} className="text-textSoft"/>
          <input type="text" placeholder="Rechercher par nom, prénom, fonction…" value={q} onChange={e => setQ(e.target.value)} className="bg-transparent border-0 outline-0 flex-1 text-[13px] placeholder:text-textSoft"/>
        </div>
        <div className="inline-flex bg-surface2 border border-border rounded p-[3px] gap-[2px]">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`border-0 px-[11px] py-[5px] font-semibold text-[12.5px] rounded-sm ${
                filter === f.value ? 'bg-surface text-text shadow-sm' : 'bg-transparent text-textMuted'
              }`}
              data-testid={`filter-pill-${f.value}`}>
              {f.label} <span className="font-mono text-[11.5px] opacity-60 ml-1.5">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1"/>
        <span className="text-textSoft font-mono text-[12.5px]">{filtered.length} résultats</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Prénom</TH>
              <TH>Fonction</TH>
              <TH>Catégorie</TH>
              <TH>Habilitation</TH>
              <TH className="w-12"/>
            </TR>
          </THead>
          <TBody>
            {filtered.map(t => {
              const hab = habilitations[t.id];
              return (
                <TR key={t.id} className="cursor-pointer" onClick={() => navigate(`/travailleurs/${t.id}`)}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar name={`${t.prenom} ${t.nom}`} size={28}/>
                      <span className="font-semibold uppercase">{t.nom}</span>
                    </div>
                  </TD>
                  <TD>{t.prenom}</TD>
                  <TD className="text-textMuted">{fonctionLabel(t.fonction)}</TD>
                  <TD><Badge variant="neutral" icon={null}>Cat. {t.categorie_reglementaire ?? '—'}</Badge></TD>
                  <TD><Badge variant={habToVariant(hab)}>{habToLabel(hab)}</Badge></TD>
                  <TD className="text-right"><ChevronRight size={14} className="text-textSoft"/></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {showAdd && <AddTravailleurModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddTravailleurModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [sexe, setSexe] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [fonction, setFonction] = useState('');
  const [categorieReglementaire, setCategorieReglementaire] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const prenomRef = useRef<HTMLInputElement>(null);
  const sexeRef = useRef<HTMLSelectElement>(null);
  const dateNaissanceRef = useRef<HTMLInputElement>(null);
  const fonctionRef = useRef<HTMLSelectElement>(null);
  const categorieRef = useRef<HTMLSelectElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telephoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { mutate, isPending } = useMutation({
    mutationFn: (input: {
      nom: string;
      prenom: string;
      sexe?: string | null;
      dateNaissance?: string | null;
      fonction?: string | null;
      categorieReglementaire?: string | null;
      email?: string | null;
      telephone?: string | null;
    }) => api.travailleur.create({ etablissementId: 1, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travailleurs'] });
      onClose();
    },
    onError: (err: unknown) => {
      setMutationError(err instanceof Error ? err.message : 'Erreur lors de la création');
    },
  });

  const canSubmit = nom.trim() && prenom.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    setMutationError(null);
    mutate({
      nom: nom.trim(),
      prenom: prenom.trim(),
      sexe: sexe || null,
      dateNaissance: dateNaissance || null,
      fonction: fonction || null,
      categorieReglementaire: categorieReglementaire || null,
      email: email || null,
      telephone: telephone || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Ajouter un travailleur</h2>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Dupont"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); prenomRef.current?.focus(); } }}
            />
            {attempted && !nom.trim() && (
              <p className="text-xs text-danger">Le nom est obligatoire.</p>
            )}
          </Field>

          <Field>
            <Label htmlFor="prenom">Prénom *</Label>
            <Input
              ref={prenomRef}
              id="prenom"
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Jean"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sexeRef.current?.focus(); } }}
            />
            {attempted && !prenom.trim() && (
              <p className="text-xs text-danger">Le prénom est obligatoire.</p>
            )}
          </Field>

          <Field>
            <Label htmlFor="sexe">Sexe</Label>
            <Select
              ref={sexeRef}
              id="sexe"
              value={sexe}
              onChange={(e) => setSexe(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
              <option value="Autre">Autre</option>
            </Select>
          </Field>

          <Field>
            <Label htmlFor="dateNaissance">Date de naissance</Label>
            <Input
              ref={dateNaissanceRef}
              id="dateNaissance"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fonctionRef.current?.focus(); } }}
            />
          </Field>

          <Field>
            <Label htmlFor="fonction">Fonction</Label>
            <Select
              ref={fonctionRef}
              id="fonction"
              value={fonction}
              onChange={(e) => setFonction(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              <option value="Cardiologue">Cardiologue</option>
              <option value="Cardiologue_liberal">Cardiologue libéral</option>
              <option value="MERM">MERM</option>
              <option value="Infirmier">Infirmier</option>
            </Select>
          </Field>

          <Field>
            <Label htmlFor="categorie">Catégorie réglementaire</Label>
            <Select
              ref={categorieRef}
              id="categorie"
              value={categorieReglementaire}
              onChange={(e) => setCategorieReglementaire(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </Select>
          </Field>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@example.com"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); telephoneRef.current?.focus(); } }}
            />
          </Field>

          <Field>
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              ref={telephoneRef}
              id="telephone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); formRef.current?.requestSubmit(); } }}
            />
          </Field>

          {mutationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {mutationError}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="ghost" type="button" onClick={onClose}>
              Annuler
            </Button>
            <div onClick={() => { if (!canSubmit) setAttempted(true); }}>
              <Button
                variant="primary"
                type="submit"
                disabled={isPending || !canSubmit}
              >
                {isPending ? 'Création...' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
