import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Edit, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { api } from '../../lib/api';

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
  const [errors, setErrors] = useState<{ denomination?: string }>({});
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

  const { data: kbisDocs = [] } = useQuery({
    queryKey: ['kbis', 1],
    queryFn: () => api.document.listForEntity('etablissement', 1),
    enabled: !!etablissement,
  });
  const kbisDoc = (kbisDocs ?? []).find(d => d.type_document === 'kbis') ?? null;

  const pickUploadMutation = useMutation({
    mutationFn: (replaceDocumentId: number | null) =>
      api.document.pickAndUpload({
        entityType: 'etablissement',
        entityId: 1,
        typeDocument: 'kbis',
        replaceDocumentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbis', 1] });
    },
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
      toast.success('Établissement mis à jour avec succès');
    },
  });

  const handleChange = (field: string, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'denomination') {
      setErrors(prev => ({ ...prev, denomination: undefined }));
    }
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
    setErrors({});
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!formData.denomination.trim()) {
      setErrors({ denomination: 'La dénomination est obligatoire' });
      return;
    }
    setErrors({});
    updateMutation.mutate();
  };

  const validateSiret = (value: string): boolean => {
    if (!value) return false;
    if (value.length !== 14) return false;
    if (!/^\d+$/.test(value)) return false;
    return true;
  };

  const siretValid = validateSiret(formData.siret || '');

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
    <div className="space-y-4">
      <PageHead
        title="Établissement"
        sub="Informations administratives et documents réglementaires"
        actions={
          isEditing ? (
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
                className="inline-flex gap-2"
              >
                <Save size={14} />
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              onClick={() => setIsEditing(true)}
              className="inline-flex gap-2"
            >
              <Edit size={14} />
              Modifier
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3.5">
        {/* Identification */}
        <Card>
          <CardHead>
            <CardTitle>Identification</CardTitle>
          </CardHead>
          <CardBody className="grid grid-cols-2 gap-y-3.5 gap-x-5">
            <Field className="col-span-2">
              <Label>Dénomination / raison sociale</Label>
              {isEditing ? (
                <>
                  <Input
                    value={formData.denomination}
                    onChange={e => handleChange('denomination', e.target.value)}
                    className={errors.denomination ? 'border-danger' : ''}
                  />
                  {errors.denomination && (
                    <p className="text-xs text-danger mt-1">{errors.denomination}</p>
                  )}
                </>
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
                    handleChange('statut_juridique', e.target.value || null)
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
                    handleChange('siret', e.target.value.replace(/\D/g, '') || null)
                  }
                  maxLength={14}
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

        {/* Coordonnées */}
        <Card>
          <CardHead>
            <CardTitle>Coordonnées</CardTitle>
          </CardHead>
          <CardBody className="grid grid-cols-2 gap-y-3.5 gap-x-5">
            <Field>
              <Label>Téléphone</Label>
              {isEditing ? (
                <Input
                  value={formData.telephone || ''}
                  onChange={e => handleChange('telephone', e.target.value || null)}
                  type="tel"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.telephone || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Email</Label>
              {isEditing ? (
                <Input
                  value={formData.email || ''}
                  onChange={e => handleChange('email', e.target.value || null)}
                  type="email"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.email || '—'}
                </div>
              )}
            </Field>

            <Field className="col-span-2">
              <Label>Site internet</Label>
              {isEditing ? (
                <Input
                  value={formData.site_internet || ''}
                  onChange={e =>
                    handleChange('site_internet', e.target.value || null)
                  }
                  type="url"
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.site_internet || '—'}
                </div>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* Adresse */}
        <Card className="col-span-2">
          <CardHead>
            <CardTitle>Adresse</CardTitle>
          </CardHead>
          <CardBody className="grid grid-cols-2 gap-y-3.5 gap-x-5">
            <Field className="col-span-2">
              <Label>Adresse</Label>
              {isEditing ? (
                <Input
                  value={formData.adresse || ''}
                  onChange={e => handleChange('adresse', e.target.value || null)}
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.adresse || '—'}
                </div>
              )}
            </Field>

            <Field>
              <Label>Code postal</Label>
              {isEditing ? (
                <Input
                  value={formData.code_postal || ''}
                  onChange={e =>
                    handleChange('code_postal', e.target.value || null)
                  }
                  maxLength={5}
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
                  onChange={e => handleChange('ville', e.target.value || null)}
                />
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text">
                  {formData.ville || '—'}
                </div>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* K-Bis */}
        <Card className="col-span-2">
          <CardHead>
            <CardTitle>Document K-Bis</CardTitle>
          </CardHead>
          <CardBody className="space-y-3.5">
            {/* SIRET row */}
            <div className="flex items-center gap-3.5 px-3.5 py-3 bg-surface2 border border-border rounded-lg">
              <div className="text-[12px] font-semibold text-textMuted uppercase tracking-[0.05em] min-w-[60px]">
                SIRET
              </div>
              <input
                value={formData.siret || ''}
                onChange={e =>
                  handleChange('siret', e.target.value.replace(/\D/g, '') || null)
                }
                maxLength={14}
                className="flex-1 bg-white border border-borderStrong rounded px-3 py-2 font-mono text-base tracking-[0.08em] font-medium outline-0"
                disabled={!isEditing}
              />
              {siretValid && <Badge variant="ok">SIRET valide</Badge>}
            </div>

            {/* K-Bis file row */}
            <div className="flex items-center gap-3 px-3.5 py-3 bg-surface2 border border-border rounded-lg">
              <div className="w-9 h-11 rounded bg-white border border-borderStrong grid place-items-center text-danger text-[10px] font-bold tracking-wider">
                PDF
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[13.5px]">
                  {kbisDoc ? kbisDoc.nom_fichier : 'Aucun document'}
                </div>
                {kbisDoc && (
                  <div className="text-textSoft text-[12px] mt-px">
                    Mis à jour le {new Date(kbisDoc.uploaded_at).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
              {!kbisDoc && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => pickUploadMutation.mutate(null)}
                  disabled={pickUploadMutation.isPending}
                >
                  {pickUploadMutation.isPending ? 'Chargement…' : 'Charger le PDF'}
                </Button>
              )}
              {kbisDoc && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => pickUploadMutation.mutate(kbisDoc.id)}
                  disabled={pickUploadMutation.isPending}
                >
                  {pickUploadMutation.isPending ? 'Chargement…' : 'Remplacer'}
                </Button>
              )}
              {kbisDoc && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => api.document.open(kbisDoc.id)}
                >
                  Ouvrir
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
