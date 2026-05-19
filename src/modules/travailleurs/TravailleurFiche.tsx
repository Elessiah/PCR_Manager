import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { ChevronLeft, Users, Shield, Pencil, Trash2 } from 'lucide-react';
import { habilitationToBadge } from '../../lib/habilitation';
import DonneesPersonnellesTab from './DonneesPersonnellesTab';
import HabilitationTab from './HabilitationTab';
import type { Travailleur } from '../../types/domain';

export default function TravailleurFiche() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'perso' | 'hab'>('perso');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: travailleur } = useQuery({
    queryKey: ['travailleur', id],
    queryFn: () => api.travailleur.get(Number(id!)),
    enabled: !!id,
  });

  const { data: habStatus } = useQuery({
    queryKey: ['habilitation', id],
    queryFn: () => api.habilitation.compute(Number(id!)),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.travailleur.delete(Number(id!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travailleurs'] });
      navigate('/travailleurs');
    },
  });

  if (!travailleur) return null;

  const habBadge = habStatus ? habilitationToBadge[habStatus.statut] : null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/travailleurs')}
        className="inline-flex items-center gap-1.5 text-textSoft text-[13px] hover:text-text transition-colors"
      >
        <ChevronLeft size={14} /> Travailleurs
      </button>

      <div className="flex items-center gap-4 mb-6">
        <Avatar name={`${travailleur.prenom} ${travailleur.nom}`} size={64} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {travailleur.prenom} {travailleur.nom}
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap text-[14px] text-textMuted mt-1">
            {travailleur.fonction && <span>{travailleur.fonction}</span>}
            {travailleur.fonction && travailleur.categorie_reglementaire && <span>·</span>}
            {travailleur.categorie_reglementaire && <span>Catégorie {travailleur.categorie_reglementaire}</span>}
            {(travailleur.fonction || travailleur.categorie_reglementaire) && travailleur.date_debut_activite && <span>·</span>}
            {travailleur.date_debut_activite && <span>Depuis {new Date(travailleur.date_debut_activite).getFullYear()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" className="inline-flex items-center gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil size={13} /> Modifier
          </Button>
          <Button variant="dangerGhost" size="sm" className="inline-flex items-center gap-1.5" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={13} /> Supprimer
          </Button>
          {habBadge && (
            <div className="text-right ml-2">
              <div className="text-[11px] font-semibold text-textSoft uppercase tracking-[0.05em] mb-1">
                Habilitation
              </div>
              <Badge variant={habBadge.variant}>{habBadge.label}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-5 -mb-px">
        {[
          { value: 'perso', label: 'Données personnelles', icon: Users },
          { value: 'hab', label: 'Habilitation', icon: Shield },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as 'perso' | 'hab')}
            className={`bg-transparent border-0 px-3.5 py-2.5 font-semibold text-[13.5px] inline-flex items-center gap-2 border-b-2 -mb-px transition-colors ${
              activeTab === tab.value
                ? 'text-accent border-accent'
                : 'text-textMuted border-transparent hover:text-text'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'perso' && <DonneesPersonnellesTab travailleur={travailleur} />}
      {activeTab === 'hab' && <HabilitationTab travailleurId={Number(id!)} />}

      {editOpen && (
        <EditTravailleurModal
          travailleur={travailleur}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['travailleur', id] });
            qc.invalidateQueries({ queryKey: ['travailleurs'] });
            setEditOpen(false);
          }}
        />
      )}

      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteOpen(false)}>
          <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Supprimer le travailleur</h2>
            <p className="text-sm text-textMuted mb-6">
              Êtes-vous sûr de vouloir supprimer <strong>{travailleur.prenom} {travailleur.nom}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button
                variant="primary"
                className="bg-danger hover:bg-danger/90"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditTravailleurModal({ travailleur, onClose, onSaved }: {
  travailleur: Travailleur;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState(travailleur.nom);
  const [prenom, setPrenom] = useState(travailleur.prenom);
  const [sexe, setSexe] = useState(travailleur.sexe ?? '');
  const [dateNaissance, setDateNaissance] = useState(travailleur.date_naissance ?? '');
  const [lieuNaissance, setLieuNaissance] = useState(travailleur.lieu_naissance ?? '');
  const [paysNaissance, setPaysNaissance] = useState(travailleur.pays_naissance ?? '');
  const [fonction, setFonction] = useState(travailleur.fonction ?? '');
  const [dateDebutActivite, setDateDebutActivite] = useState(travailleur.date_debut_activite ?? '');
  const [categorieReglementaire, setCategorieReglementaire] = useState(travailleur.categorie_reglementaire ?? '');
  const [numeroAdeliRpps, setNumeroAdeliRpps] = useState(travailleur.numero_adeli_rpps ?? '');
  const [email, setEmail] = useState(travailleur.email ?? '');
  const [telephone, setTelephone] = useState(travailleur.telephone ?? '');
  const [numeroSecuriteSociale, setNumeroSecuriteSociale] = useState(travailleur.numero_securite_sociale ?? '');
  const [numeroPorteurDosimetriePassive, setNumeroPorteurDosimetriePassive] = useState(travailleur.numero_porteur_dosimetrie_passive ?? '');
  const [numeroSuiviMedical, setNumeroSuiviMedical] = useState(travailleur.numero_suivi_medical ?? '');
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.travailleur.update({
      id: travailleur.id,
      etablissementId: travailleur.etablissement_id,
      nom: nom.trim(),
      prenom: prenom.trim(),
      sexe: sexe || null,
      dateNaissance: dateNaissance || null,
      lieuNaissance: lieuNaissance || null,
      paysNaissance: paysNaissance || null,
      fonction: fonction || null,
      dateDebutActivite: dateDebutActivite || null,
      categorieReglementaire: categorieReglementaire || null,
      numeroAdeliRpps: numeroAdeliRpps || null,
      email: email || null,
      telephone: telephone || null,
      numeroSecuriteSociale: numeroSecuriteSociale || null,
      numeroPorteurDosimetriePassive: numeroPorteurDosimetriePassive || null,
      numeroSuiviMedical: numeroSuiviMedical || null,
    }),
    onSuccess: onSaved,
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur lors de la modification'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim()) return;
    setError(null);
    mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-2xl p-6 m-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Modifier le travailleur</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field><Label>Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" /></Field>
            <Field><Label>Prénom *</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" /></Field>
            <Field>
              <Label>Sexe</Label>
              <Select value={sexe} onChange={e => setSexe(e.target.value)}>
                <option value="">— Sélectionner —</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="Autre">Autre</option>
              </Select>
            </Field>
            <Field><Label>Date de naissance</Label><Input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} /></Field>
            <Field><Label>Lieu de naissance</Label><Input value={lieuNaissance} onChange={e => setLieuNaissance(e.target.value)} /></Field>
            <Field><Label>Pays de naissance</Label><Input value={paysNaissance} onChange={e => setPaysNaissance(e.target.value)} /></Field>
            <Field>
              <Label>Fonction</Label>
              <Select value={fonction} onChange={e => setFonction(e.target.value)}>
                <option value="">— Sélectionner —</option>
                <option value="Cardiologue">Cardiologue</option>
                <option value="Cardiologue_liberal">Cardiologue libéral</option>
                <option value="MERM">MERM</option>
                <option value="Infirmier">Infirmier</option>
              </Select>
            </Field>
            <Field><Label>Date de début d'activité</Label><Input type="date" value={dateDebutActivite} onChange={e => setDateDebutActivite(e.target.value)} /></Field>
            <Field>
              <Label>Catégorie réglementaire</Label>
              <Select value={categorieReglementaire} onChange={e => setCategorieReglementaire(e.target.value)}>
                <option value="">— Sélectionner —</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </Select>
            </Field>
            <Field><Label>N° ADELI / RPPS</Label><Input value={numeroAdeliRpps} onChange={e => setNumeroAdeliRpps(e.target.value)} /></Field>
            <Field><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field><Label>Téléphone</Label><Input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} /></Field>
            <Field><Label>N° sécurité sociale</Label><Input value={numeroSecuriteSociale} onChange={e => setNumeroSecuriteSociale(e.target.value)} /></Field>
            <Field><Label>N° porteur dosimétrie passive</Label><Input value={numeroPorteurDosimetriePassive} onChange={e => setNumeroPorteurDosimetriePassive(e.target.value)} /></Field>
            <Field><Label>N° suivi médical</Label><Input value={numeroSuiviMedical} onChange={e => setNumeroSuiviMedical(e.target.value)} /></Field>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Annuler</Button>
            <Button variant="primary" type="submit" disabled={!nom.trim() || !prenom.trim() || isPending}>
              {isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
