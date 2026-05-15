import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Travailleur } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Field, Label, Input, Select } from '../../components/ui/FormField';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';

interface DonneesPersonnellesTabProps {
  travailleur: Travailleur;
}

export default function DonneesPersonnellesTab({ travailleur }: DonneesPersonnellesTabProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(travailleur);

  const mutation = useMutation({
    mutationFn: () =>
      api.travailleur.update({
        id: formData.id,
        etablissementId: formData.etablissement_id,
        nom: formData.nom,
        prenom: formData.prenom,
        sexe: formData.sexe,
        dateNaissance: formData.date_naissance,
        lieuNaissance: formData.lieu_naissance,
        paysNaissance: formData.pays_naissance,
        fonction: formData.fonction,
        dateDebutActivite: formData.date_debut_activite,
        categorieReglementaire: formData.categorie_reglementaire,
        numeroAdeliRpps: formData.numero_adeli_rpps,
        email: formData.email,
        telephone: formData.telephone,
        numeroSecuriteSociale: formData.numero_securite_sociale,
        numeroPorteurDosimetriePassive: formData.numero_porteur_dosimetrie_passive,
        numeroSuiviMedical: formData.numero_suivi_medical,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travailleur', travailleur.id] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHead>
            <CardTitle>Identité</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Nom</Label>
              <Input
                value={formData.nom}
                onChange={e => setFormData({ ...formData, nom: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Prénom</Label>
              <Input
                value={formData.prenom}
                onChange={e => setFormData({ ...formData, prenom: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Sexe</Label>
              <Select
                value={formData.sexe || ''}
                onChange={e => setFormData({ ...formData, sexe: e.target.value || null })}
              >
                <option value="">-</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </Select>
            </Field>
            <Field>
              <Label>Date de naissance</Label>
              <Input
                type="date"
                value={formData.date_naissance || ''}
                onChange={e => setFormData({ ...formData, date_naissance: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Lieu de naissance</Label>
              <Input
                value={formData.lieu_naissance || ''}
                onChange={e => setFormData({ ...formData, lieu_naissance: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Pays de naissance</Label>
              <Input
                value={formData.pays_naissance || ''}
                onChange={e => setFormData({ ...formData, pays_naissance: e.target.value || null })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Activité professionnelle</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Fonction</Label>
              <Input
                value={formData.fonction || ''}
                onChange={e => setFormData({ ...formData, fonction: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Date de début d'activité</Label>
              <Input
                type="date"
                value={formData.date_debut_activite || ''}
                onChange={e => setFormData({ ...formData, date_debut_activite: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Catégorie réglementaire</Label>
              <Input
                value={formData.categorie_reglementaire || ''}
                onChange={e => setFormData({ ...formData, categorie_reglementaire: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Numéro ADELI / RPPS</Label>
              <Input
                value={formData.numero_adeli_rpps || ''}
                onChange={e => setFormData({ ...formData, numero_adeli_rpps: e.target.value || null })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Coordonnées</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Téléphone</Label>
              <Input
                value={formData.telephone || ''}
                onChange={e => setFormData({ ...formData, telephone: e.target.value || null })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <CardTitle>Suivi réglementaire</CardTitle>
          </CardHead>
          <CardBody className="space-y-4">
            <Field>
              <Label>Numéro sécurité sociale</Label>
              <Input
                value={formData.numero_securite_sociale || ''}
                onChange={e => setFormData({ ...formData, numero_securite_sociale: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Numéro porteur dosimétrie passive</Label>
              <Input
                value={formData.numero_porteur_dosimetrie_passive || ''}
                onChange={e => setFormData({ ...formData, numero_porteur_dosimetrie_passive: e.target.value || null })}
              />
            </Field>
            <Field>
              <Label>Numéro suivi médical</Label>
              <Input
                value={formData.numero_suivi_medical || ''}
                onChange={e => setFormData({ ...formData, numero_suivi_medical: e.target.value || null })}
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost">Annuler</Button>
        <Button
          variant="primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
