import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { statusFromDate, statusToBadgeVariant } from '../../lib/status';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
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
          <Button variant="primary" className="inline-flex items-center gap-2">
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
    </div>
  );
}
