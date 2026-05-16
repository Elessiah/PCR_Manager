import type { Travailleur } from '../../types/domain';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { ReadField } from '../../components/ui/ReadField';

interface DonneesPersonnellesTabProps {
  travailleur: Travailleur;
}

export default function DonneesPersonnellesTab({ travailleur }: DonneesPersonnellesTabProps) {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR');
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
    </div>
  );
}
