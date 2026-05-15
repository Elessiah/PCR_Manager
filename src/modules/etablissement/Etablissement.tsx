import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { api } from '../../lib/api';
import KbisSection from './KbisSection';

const STATUTS_JURIDIQUES = [
  'SAS',
  'SA',
  'SARL',
  'EIRL',
  'SCM',
  'Association',
  'Établissement public',
];

export default function Etablissement() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    denomination: '',
    statut_juridique: null as string | null,
    siret: null as string | null,
    adresse: null as string | null,
    code_postal: null as string | null,
    ville: null as string | null,
    telephone: null as string | null,
    email: null as string | null,
    site_internet: null as string | null,
  });

  const { data: etablissement, isLoading } = useQuery({
    queryKey: ['etablissement', 1],
    queryFn: () => api.etablissement.get(1),
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (etablissement) {
      setFormData({
        denomination: etablissement.denomination,
        statut_juridique: etablissement.statut_juridique,
        siret: etablissement.siret,
        adresse: etablissement.adresse,
        code_postal: etablissement.code_postal,
        ville: etablissement.ville,
        telephone: etablissement.telephone,
        email: etablissement.email,
        site_internet: etablissement.site_internet,
      });
    }
  }, [etablissement]);

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
        siteInternet: formData.site_internet,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etablissement'] });
      setIsEditing(false);
    },
  });

  const handleChange = (field: string, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    if (etablissement) {
      setFormData({
        denomination: etablissement.denomination,
        statut_juridique: etablissement.statut_juridique,
        siret: etablissement.siret,
        adresse: etablissement.adresse,
        code_postal: etablissement.code_postal,
        ville: etablissement.ville,
        telephone: etablissement.telephone,
        email: etablissement.email,
        site_internet: etablissement.site_internet,
      });
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-textMuted text-sm">
        Chargement des données de l'établissement...
      </div>
    );
  }

  if (!etablissement) {
    return (
      <div className="p-8 text-textMuted text-sm">
        Établissement non trouvé
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header avec actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">Établissement</h1>
          <p className="text-sm text-textMuted mt-1">
            Informations administratives et documents réglementaires
          </p>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setIsEditing(true)}>
              Modifier
            </Button>
          )}
        </div>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Identification Card */}
        <Card>
          <CardHead>
            <CardTitle>Identification</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Dénomination / raison sociale</Label>
              {isEditing ? (
                <Input
                  value={formData.denomination}
                  onChange={e => handleChange('denomination', e.target.value)}
                  placeholder="Nom de l'établissement"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.denomination || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Statut juridique</Label>
              {isEditing ? (
                <Select
                  value={formData.statut_juridique || ''}
                  onChange={e =>
                    handleChange(
                      'statut_juridique',
                      e.target.value || null
                    )
                  }
                >
                  <option value="">Sélectionner...</option>
                  {STATUTS_JURIDIQUES.map(statut => (
                    <option key={statut} value={statut}>
                      {statut}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.statut_juridique || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Numéro SIRET</Label>
              {isEditing ? (
                <Input
                  value={formData.siret || ''}
                  onChange={e =>
                    handleChange(
                      'siret',
                      e.target.value.replace(/\D/g, '') || null
                    )
                  }
                  maxLength={14}
                  placeholder="14 chiffres"
                  className="font-mono"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text font-mono">
                  {formData.siret || '—'}
                </div>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* Coordonnées Card */}
        <Card>
          <CardHead>
            <CardTitle>Coordonnées</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Téléphone</Label>
              {isEditing ? (
                <Input
                  value={formData.telephone || ''}
                  onChange={e =>
                    handleChange('telephone', e.target.value || null)
                  }
                  type="tel"
                  placeholder="Numéro de téléphone"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.telephone || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Adresse mail</Label>
              {isEditing ? (
                <Input
                  value={formData.email || ''}
                  onChange={e =>
                    handleChange('email', e.target.value || null)
                  }
                  type="email"
                  placeholder="Adresse email"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.email || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Site internet</Label>
              {isEditing ? (
                <Input
                  value={formData.site_internet || ''}
                  onChange={e =>
                    handleChange('site_internet', e.target.value || null)
                  }
                  type="url"
                  placeholder="https://..."
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.site_internet || '—'}
                </div>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* Adresse Card - full width */}
        <Card className="col-span-2">
          <CardHead>
            <CardTitle>Adresse</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Adresse</Label>
              {isEditing ? (
                <Input
                  value={formData.adresse || ''}
                  onChange={e =>
                    handleChange('adresse', e.target.value || null)
                  }
                  placeholder="Rue, numéro..."
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.adresse || '—'}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Code postal</Label>
                {isEditing ? (
                  <Input
                    value={formData.code_postal || ''}
                    onChange={e =>
                      handleChange('code_postal', e.target.value || null)
                    }
                    maxLength={5}
                    placeholder="75000"
                    className="font-mono"
                  />
                ) : (
                  <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text font-mono">
                    {formData.code_postal || '—'}
                  </div>
                )}
              </Field>

              <Field>
                <Label>Ville</Label>
                {isEditing ? (
                  <Input
                    value={formData.ville || ''}
                    onChange={e =>
                      handleChange('ville', e.target.value || null)
                    }
                    placeholder="Ville"
                  />
                ) : (
                  <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                    {formData.ville || '—'}
                  </div>
                )}
              </Field>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* K-Bis Section */}
      {etablissement && <KbisSection etablissement={etablissement} isEditing={isEditing} />}
    </div>
  );
}
