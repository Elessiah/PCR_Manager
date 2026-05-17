import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Field, Label, Input } from '../../components/ui/FormField';
import { Plus, Search, ChevronRight } from 'lucide-react';

function AddAppareilModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [designation, setDesignation] = useState('');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [type, setType] = useState('');
  const [lieuUtilisation, setLieuUtilisation] = useState('');
  const [utilisationPartagee, setUtilisationPartagee] = useState(false);

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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!designation.trim()) return;
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
              required
            />
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
            <Input
              id="type"
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder="Ex : Rayons X"
            />
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
          <Field className="flex flex-row items-center gap-2">
            <input
              id="utilisationPartagee"
              type="checkbox"
              checked={utilisationPartagee}
              onChange={e => setUtilisationPartagee(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="utilisationPartagee" className="m-0">
              Utilisation partagée
            </Label>
          </Field>
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
    const daysToAdd = type === 'annuelle_interne' ? 365 : 1095;
    const next = new Date(latest.date_realisation);
    next.setDate(next.getDate() + daysToAdd);
    return next.toISOString().split('T')[0];
  };

  const getVerificationStatus = (appareilId: number) => {
    const annual = getNextVerificationDue(appareilId, 'annuelle_interne');
    const triennial = getNextVerificationDue(appareilId, 'triennale_externe');
    const earliest = [annual, triennial].filter(Boolean).sort()[0];
    return statusFromDate(earliest);
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
    return statusFromDate(next);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'valide':
        return 'À jour';
      case 'a_prevoir':
        return 'À prévoir';
      case 'en_retard':
        return 'Invalide';
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
