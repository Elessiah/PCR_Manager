import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Field, Label, Input, Select } from '../ui/FormField';

const STATUTS_JURIDIQUES = [
  'SAS',
  'SA',
  'SARL',
  'EIRL',
  'SCM',
  'Association',
  'Établissement public',
];

export default function FirstSetupModal() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    denomination: '',
    statut_juridique: null as string | null,
    siret: null as string | null,
    adresse: null as string | null,
    code_postal: null as string | null,
    ville: null as string | null,
    telephone: null as string | null,
    email: null as string | null,
  });

  const { data: etablissement, isLoading } = useQuery({
    queryKey: ['etablissement', 1],
    queryFn: () => api.etablissement.get(1),
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.etablissement.update({
        id: 1,
        denomination: formData.denomination,
        statutJuridique: formData.statut_juridique,
        siret: formData.siret,
        adresse: formData.adresse,
        codePostal: formData.code_postal,
        ville: formData.ville,
        telephone: formData.telephone,
        email: formData.email,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etablissement'] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const handleChange = (field: string, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSiretChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    handleChange('siret', cleaned || null);
  };

  if (isLoading) return null;
  if (!etablissement || etablissement.denomination !== 'Cabinet Cardio Démo') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-lg w-full mx-4 rounded-xl border border-border bg-surface shadow-2xl p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-text">
            Bienvenue dans PCR Manager
          </h2>
          <p className="text-sm text-textMuted">
            Avant de commencer, renseignez les informations de votre établissement.
          </p>
        </div>

        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            if (!formData.denomination.trim()) return;
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <Field>
            <Label htmlFor="denomination">
              Dénomination / raison sociale <span className="text-danger">*</span>
            </Label>
            <Input
              id="denomination"
              type="text"
              placeholder="Saisissez le nom de votre établissement"
              value={formData.denomination}
              onChange={e => handleChange('denomination', e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="statut_juridique">Statut juridique</Label>
            <Select
              id="statut_juridique"
              value={formData.statut_juridique || ''}
              onChange={e => handleChange('statut_juridique', e.target.value || null)}
            >
              <option value="">-- Sélectionner --</option>
              {STATUTS_JURIDIQUES.map(statut => (
                <option key={statut} value={statut}>
                  {statut}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="siret">Numéro SIRET</Label>
            <Input
              id="siret"
              type="text"
              placeholder="14 chiffres"
              maxLength={14}
              className="font-mono"
              value={formData.siret || ''}
              onChange={e => handleSiretChange(e.target.value)}
            />
          </Field>

          <Field>
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              type="text"
              placeholder="Rue, numéro..."
              value={formData.adresse || ''}
              onChange={e => handleChange('adresse', e.target.value || null)}
            />
          </Field>

          <Field>
            <Label htmlFor="code_postal">Code postal</Label>
            <Input
              id="code_postal"
              type="text"
              placeholder="5 chiffres"
              maxLength={5}
              className="font-mono"
              value={formData.code_postal || ''}
              onChange={e => handleChange('code_postal', e.target.value || null)}
            />
          </Field>

          <Field>
            <Label htmlFor="ville">Ville</Label>
            <Input
              id="ville"
              type="text"
              placeholder="Ville"
              value={formData.ville || ''}
              onChange={e => handleChange('ville', e.target.value || null)}
            />
          </Field>

          <Field>
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              type="text"
              placeholder="Numéro de téléphone"
              value={formData.telephone || ''}
              onChange={e => handleChange('telephone', e.target.value || null)}
            />
          </Field>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="text"
              placeholder="contact@exemple.fr"
              value={formData.email || ''}
              onChange={e => handleChange('email', e.target.value || null)}
            />
          </Field>

          {!formData.denomination.trim() && (
            <p className="text-xs text-textMuted text-center">
              La dénomination est obligatoire pour continuer.
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={updateMutation.isPending || !formData.denomination.trim()}
          >
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer et continuer'}
          </Button>
        </form>
      </div>
    </div>
  );
}
