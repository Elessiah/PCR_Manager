import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Travailleur } from '../../types/domain';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { ReadField } from '../../components/ui/ReadField';
import { api } from '../../lib/api';

interface DonneesPersonnellesTabProps {
  travailleur: Travailleur;
}

export default function DonneesPersonnellesTab({ travailleur }: DonneesPersonnellesTabProps) {
  const queryClient = useQueryClient();
  const [selectedAppareilIds, setSelectedAppareilIds] = useState<number[]>([]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const { data: assignedIds = [] } = useQuery({
    queryKey: ['travailleurAppareil', travailleur.id],
    queryFn: () => api.travailleurAppareil.list(travailleur.id),
  });

  const { data: appareils = [] } = useQuery({
    queryKey: ['appareils'],
    queryFn: () => api.appareil.list(),
  });

  const assignedSet = new Set(assignedIds);
  const assignedAppareils = appareils.filter(a => assignedSet.has(a.id));
  const availableAppareils = appareils.filter(
    a => a.etablissement_id === travailleur.etablissement_id && !assignedSet.has(a.id)
  );

  const handleRemoveAppareil = async (appareilId: number) => {
    try {
      await api.travailleurAppareil.remove(travailleur.id, appareilId);
      queryClient.invalidateQueries({ queryKey: ['travailleurAppareil', travailleur.id] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleur.id] });
    } catch (error) {
      console.error('Erreur lors du retrait de l\'appareil:', error);
    }
  };

  const handleAddAppareils = async () => {
    if (selectedAppareilIds.length === 0) return;
    try {
      for (const appareilId of selectedAppareilIds) {
        await api.travailleurAppareil.add(travailleur.id, appareilId);
      }
      queryClient.invalidateQueries({ queryKey: ['travailleurAppareil', travailleur.id] });
      queryClient.invalidateQueries({ queryKey: ['habilitation', travailleur.id] });
      setSelectedAppareilIds([]);
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'appareils:', error);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHead>
          <CardTitle>Identité</CardTitle>
        </CardHead>
        <CardBody>
          <div className="form-grid space-y-4">
            <ReadField label="Nom" value={travailleur.nom?.toUpperCase()} />
            <ReadField label="Prénom" value={travailleur.prenom} />
            <ReadField label="Sexe" value={travailleur.sexe === 'M' ? 'Masculin' : travailleur.sexe === 'F' ? 'Féminin' : null} />
            <ReadField label="Date de naissance" value={formatDate(travailleur.date_naissance)} />
            <ReadField label="Lieu de naissance" value={travailleur.lieu_naissance} />
            <ReadField label="Pays de naissance" value={travailleur.pays_naissance} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Activité professionnelle</CardTitle>
        </CardHead>
        <CardBody>
          <div className="form-grid space-y-4">
            <ReadField label="Fonction" value={travailleur.fonction} />
            <ReadField label="Date de début d'activité" value={formatDate(travailleur.date_debut_activite)} />
            <ReadField label="Catégorie réglementaire" value={travailleur.categorie_reglementaire} />
            <ReadField label="Numéro ADELI / RPPS" value={travailleur.numero_adeli_rpps} mono />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Coordonnées</CardTitle>
        </CardHead>
        <CardBody>
          <div className="form-grid space-y-4">
            <ReadField label="Email" value={travailleur.email} />
            <ReadField label="Téléphone" value={travailleur.telephone} mono />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <CardTitle>Suivi réglementaire</CardTitle>
        </CardHead>
        <CardBody>
          <div className="form-grid space-y-4">
            <ReadField label="Numéro sécurité sociale" value={travailleur.numero_securite_sociale} mono />
            <ReadField label="Numéro porteur dosimétrie passive" value={travailleur.numero_porteur_dosimetrie_passive} mono />
            <ReadField label="Numéro suivi médical" value={travailleur.numero_suivi_medical} mono />
          </div>
        </CardBody>
      </Card>

      <Card className="col-span-2">
        <CardHead>
          <CardTitle>Appareils assignés</CardTitle>
        </CardHead>
        <CardBody>
          <div className="space-y-4">
            {assignedAppareils.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedAppareils.map(appareil => (
                  <div
                    key={appareil.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-bgSecondary border border-border rounded-full text-[13px]"
                  >
                    <span>{appareil.designation}</span>
                    <button
                      onClick={() => handleRemoveAppareil(appareil.id)}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-bgTertiary transition-colors"
                      title="Retirer cet appareil"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-textMuted italic">
                Aucun appareil assigné — le bloc Compétences de l'habilitation ne pourra pas être validé.
              </div>
            )}

            {availableAppareils.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <label className="block text-[13px] font-semibold text-textMuted">
                  Ajouter des appareils
                </label>
                <select
                  multiple
                  size={4}
                  value={selectedAppareilIds.map(String)}
                  onChange={e =>
                    setSelectedAppareilIds(
                      Array.from(e.currentTarget.selectedOptions).map(o => Number(o.value))
                    )
                  }
                  className="w-full px-2 py-1.5 bg-bg border border-border rounded text-[13px] text-text"
                >
                  {availableAppareils.map(appareil => (
                    <option key={appareil.id} value={appareil.id}>
                      {appareil.designation}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddAppareils}
                  disabled={selectedAppareilIds.length === 0}
                  className="px-3 py-2 bg-accent text-white rounded text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  Ajouter
                </button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
