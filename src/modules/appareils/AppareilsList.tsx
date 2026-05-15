import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Plus, Search, ChevronRight } from 'lucide-react';

export default function AppareilsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

  const getLatestControleExterne = (appareilId: number) => {
    return controles
      .filter(c => c.appareil_id === appareilId && c.type_ === 'externe')
      .sort((a, b) => new Date(b.date_realisation || '').getTime() - new Date(a.date_realisation || '').getTime())[0];
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

  const handleRowClick = (id: number) => {
    navigate(`/appareils/${id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Appareils</h1>
        <p className="text-sm text-textMuted">{appareils.length} appareils radiologiques sous contrôle réglementaire</p>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="primary" className="inline-flex items-center gap-2">
          <Plus size={16} />
          Nouvel appareil
        </Button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
          <input
            type="text"
            placeholder="Rechercher un appareil"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded border border-border bg-surface text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <span className="text-xs text-textMuted">{filtered.length} résultats</span>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Désignation</TH>
              <TH>Numéro de série</TH>
              <TH>Lieu d'utilisation</TH>
              <TH>Vérification technique</TH>
              <TH>Contrôle qualité</TH>
              <TH style={{ width: 50, textAlign: 'right' }}></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map(a => {
              const verifStatus = getVerificationStatus(a.id);
              const cqStatus = getControleQualiteStatus(a.id);
              const verifVariant = statusToBadgeVariant[verifStatus];
              const cqVariant = statusToBadgeVariant[cqStatus];

              return (
                <TR
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(a.id)}
                >
                  <TD>
                    <div className="font-medium">{a.designation}</div>
                    <div className="text-xs text-textMuted mt-1">{a.marque} · {a.modele}</div>
                  </TD>
                  <TD className="font-mono text-sm">{a.numero_serie || '-'}</TD>
                  <TD className="text-textMuted">
                    {a.lieu_utilisation}
                    {a.utilisation_partagee && (
                      <Badge variant="neutral" className="ml-2">partagé</Badge>
                    )}
                  </TD>
                  <TD>
                    <Badge variant={verifVariant}>
                      {verifStatus === 'valide' && 'Valide'}
                      {verifStatus === 'a_prevoir' && 'À prévoir'}
                      {verifStatus === 'en_retard' && 'En retard'}
                      {verifStatus === 'non_applicable' && 'N/A'}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge variant={cqVariant}>
                      {cqStatus === 'valide' && 'Valide'}
                      {cqStatus === 'a_prevoir' && 'À prévoir'}
                      {cqStatus === 'en_retard' && 'En retard'}
                      {cqStatus === 'non_applicable' && 'N/A'}
                    </Badge>
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <ChevronRight size={16} className="text-textMuted" />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
