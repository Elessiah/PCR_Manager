import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { Plus, Search, ChevronRight, Users } from 'lucide-react';

function AddAppareilModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [designation, setDesignation] = useState('');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [type, setType] = useState('');
  const [lieuUtilisation, setLieuUtilisation] = useState('');
  const [utilisationPartagee, setUtilisationPartagee] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      api.appareil.create({
        etablissementId: 1,
        designation,
        marque: marque || null,
        modele: modele || null,
        numeroSerie: numeroSerie || null,
        type: type || null,
        lieuUtilisation: lieuUtilisation || null,
        utilisationPartagee: utilisationPartagee ? 1 : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appareils'] });
      onClose();
    },
    onError: (err: unknown) => {
      setMutationError(err instanceof Error ? err.message : 'Erreur lors de la création');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!designation.trim()) return;
    setMutationError(null);
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold">Ajouter un appareil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <Label htmlFor="designation">Désignation *</Label>
            <Input
              id="designation"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="Ex : Tube radiogène"
              autoFocus
            />
            {attempted && !designation.trim() && (
              <p className="text-xs text-danger">La désignation est obligatoire.</p>
            )}
          </Field>
          <Field>
            <Label htmlFor="marque">Marque</Label>
            <Input
              id="marque"
              value={marque}
              onChange={e => setMarque(e.target.value)}
              placeholder="Ex : Philips"
            />
          </Field>
          <Field>
            <Label htmlFor="modele">Modèle</Label>
            <Input
              id="modele"
              value={modele}
              onChange={e => setModele(e.target.value)}
              placeholder="Ex : X200"
            />
          </Field>
          <Field>
            <Label htmlFor="numeroSerie">Numéro de série</Label>
            <Input
              id="numeroSerie"
              value={numeroSerie}
              onChange={e => setNumeroSerie(e.target.value)}
              placeholder="Ex : NS-123456"
            />
          </Field>
          <Field>
            <Label htmlFor="type">Type</Label>
            <Select id="type" value={type} onChange={e => setType(e.target.value)}>
              <option value="">— Sélectionner —</option>
              <option value="Fixe">Fixe</option>
              <option value="Deplacable">Déplaçable</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="lieuUtilisation">Lieu d'utilisation</Label>
            <Input
              id="lieuUtilisation"
              value={lieuUtilisation}
              onChange={e => setLieuUtilisation(e.target.value)}
              placeholder="Ex : Salle 101"
            />
          </Field>
          <button
            type="button"
            onClick={() => setUtilisationPartagee(v => !v)}
            className={[
              'flex items-center gap-3 w-full px-3 py-2.5 rounded border text-sm font-medium transition-colors duration-150',
              utilisationPartagee
                ? 'border-accent bg-accentSoft text-accent'
                : 'border-border bg-surface text-textMuted hover:bg-surfaceHover',
            ].join(' ')}
          >
            <span
              className={[
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
                utilisationPartagee ? 'bg-accent' : 'bg-border',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                  utilisationPartagee ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
            <Users size={14} className="shrink-0" />
            Utilisation partagée
          </button>
          {mutationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {mutationError}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || !designation.trim()}
            >
              {mutation.isPending ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AppareilsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowAdd(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['verifications'],
    queryFn: () => api.verification.list(),
  });

  const { data: controles = [] } = useQuery({
    queryKey: ['controles'],
    queryFn: () => api.controleQualite.list(),
  });

  const filtered = appareils.filter(a => {
    const query = searchQuery.toLowerCase();
    return (
      a.designation.toLowerCase().includes(query) ||
      (a.marque?.toLowerCase().includes(query) ?? false) ||
      (a.modele?.toLowerCase().includes(query) ?? false) ||
      (a.numero_serie?.toLowerCase().includes(query) ?? false) ||
      (a.lieu_utilisation?.toLowerCase().includes(query) ?? false)
    );
  });

  const getLatestVerification = (appareilId: number, type: string) => {
    return verifications
      .filter(v => v.appareil_id === appareilId && v.type_ === type)
      .sort((a, b) => new Date(b.date_realisation).getTime() - new Date(a.date_realisation).getTime())[0];
  };

  const getNextVerificationDue = (appareilId: number, type: string) => {
    const latest = getLatestVerification(appareilId, type);
    if (!latest) return null;
    const next = new Date(latest.date_realisation);
    if (type === 'annuelle_interne') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setFullYear(next.getFullYear() + 3);
    }
    return next.toISOString().split('T')[0];
  };

  const getVerificationStatus = (appareilId: number) => {
    const annual = getNextVerificationDue(appareilId, 'annuelle_interne');
    const triennial = getNextVerificationDue(appareilId, 'triennale_externe');
    const earliest = [annual, triennial].filter(Boolean).sort()[0];
    return statusFromDate(earliest, 3);
  };

  const getNextControleQualite = (appareilId: number) => {
    const internes = controles.filter(c => c.appareil_id === appareilId && c.type_ !== 'externe');
    const pending = internes.filter(c => new Date(c.date_echeance) >= new Date());
    if (pending.length > 0) {
      return pending.sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())[0].date_echeance;
    }
    return internes.length > 0 ? internes[internes.length - 1].date_echeance : null;
  };

  const getControleQualiteStatus = (appareilId: number) => {
    const next = getNextControleQualite(appareilId);
    return statusFromDate(next, 3);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'valide':
        return 'À jour';
      case 'a_prevoir':
        return 'À prévoir';
      case 'en_retard':
        return 'En retard';
      case 'non_applicable':
        return 'N/A';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Appareils"
        sub={`${appareils.length} appareils radiologiques sous contrôle réglementaire`}
        actions={
          <Button
            variant="primary"
            className="inline-flex items-center gap-2"
            onClick={() => setShowAdd(true)}
            title="Ajouter un appareil (CTRL+N)"
          >
            <Plus size={14} />
            Ajouter un appareil
          </Button>
        }
      />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface border border-border rounded px-2.5 py-1.5 w-[340px]">
          <Search size={14} className="text-textSoft" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un appareil"
            className="bg-transparent border-0 outline-0 flex-1 text-[13px] placeholder:text-textSoft"
          />
        </div>
        <div className="flex-1" />
        <span className="text-textSoft font-mono text-[12.5px]">{filtered.length} résultats</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Désignation</TH>
              <TH>Numéro de série</TH>
              <TH>Lieu</TH>
              <TH>Vérification technique</TH>
              <TH>Contrôle qualité</TH>
              <TH className="w-12" />
            </TR>
          </THead>
          <TBody>
            {filtered.map(a => {
              const verifStatus = getVerificationStatus(a.id);
              const cqStatus = getControleQualiteStatus(a.id);
              const verifVariant = statusToBadgeVariant[verifStatus];
              const cqVariant = statusToBadgeVariant[cqStatus];
              const nextVerifDate = getNextVerificationDue(a.id, 'annuelle_interne') || getNextVerificationDue(a.id, 'triennale_externe');
              const nextCqDate = getNextControleQualite(a.id);

              return (
                <TR
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/appareils/${a.id}`)}
                >
                  <TD>
                    <div className="font-semibold">{a.designation}</div>
                    <div className="text-textSoft text-[12px] mt-px">
                      {a.marque} · {a.modele}
                    </div>
                  </TD>
                  <TD>
                    <span className="font-mono tabular-nums text-[12.5px] text-textMuted">
                      {a.numero_serie ?? '—'}
                    </span>
                  </TD>
                  <TD className="text-textMuted">
                    <span>{a.lieu_utilisation}</span>
                    {Boolean(a.utilisation_partagee) && (
                      <Badge variant="neutral" icon={null} className="ml-1.5">
                        partagé
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    <Badge variant={verifVariant}>{statusLabel(verifStatus)}</Badge>
                    <div className="text-textSoft font-mono text-[11.5px] mt-1">
                      Échéance {nextVerifDate ?? '—'}
                    </div>
                  </TD>
                  <TD>
                    <Badge variant={cqVariant}>{statusLabel(cqStatus)}</Badge>
                    <div className="text-textSoft font-mono text-[11.5px] mt-1">
                      Prochain {nextCqDate ?? '—'}
                    </div>
                  </TD>
                  <TD className="text-right">
                    <ChevronRight size={14} className="text-textSoft" />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {showAdd && <AddAppareilModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
