import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { habilitationToBadge } from '../../lib/habilitation';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

type HabilitationFilter = 'tous' | 'validee' | 'partielle' | 'non_validee';

export default function TravailleursList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [habilitationFilter, setHabilitationFilter] = useState<HabilitationFilter>('tous');
  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
    })),
  });

  const habilitationMap = travailleurs.reduce((acc, t, idx) => {
    const result = habilitationQueries[idx]?.data;
    acc[t.id] = result?.statut ?? 'non_validee';
    return acc;
  }, {} as Record<number, string>);

  const counts = useMemo(() => {
    const validee = Object.values(habilitationMap).filter(s => s === 'validee').length;
    const partielle = Object.values(habilitationMap).filter(s => s === 'partielle').length;
    const non_validee = Object.values(habilitationMap).filter(s => s === 'non_validee').length;
    return {
      tous: travailleurs.length,
      validee,
      partielle,
      non_validee,
    };
  }, [habilitationMap, travailleurs.length]);

  const filtered = travailleurs.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      t.nom.toLowerCase().includes(query) ||
      t.prenom.toLowerCase().includes(query) ||
      (t.fonction?.toLowerCase().includes(query) ?? false);

    if (!matchesSearch) return false;

    if (habilitationFilter === 'tous') return true;
    return habilitationMap[t.id] === habilitationFilter;
  });

  const handleRowClick = (id: number) => {
    navigate(`/travailleurs/${id}`);
  };

  const getInitials = (prenom: string, nom: string) => {
    return ((prenom?.[0] ?? nom?.[0] ?? '') + (nom?.[0] ?? '')).toUpperCase();
  };

  const getAvatarColors = (name: string) => {
    const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return {
      bg: `hsl(${hue} 65% 85%)`,
      fg: `hsl(${hue} 60% 30%)`,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Travailleurs</h1>
        <p className="text-sm text-textMuted">{travailleurs.length} travailleurs sous suivi radioprotection</p>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="primary" className="inline-flex items-center gap-2">
          <Plus size={16} />
          Nouveau travailleur
        </Button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={16} />
          <input
            type="text"
            placeholder="Rechercher un travailleur"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded border border-border bg-surface text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <span className="text-xs text-textMuted">{filtered.length} résultats</span>
      </div>

      <div className="flex gap-2">
        {(['tous', 'validee', 'partielle', 'non_validee'] as HabilitationFilter[]).map((filter) => {
          const labels: Record<HabilitationFilter, string> = {
            tous: 'Tous',
            validee: 'Validée',
            partielle: 'Partielle',
            non_validee: 'Non validée',
          };
          const isActive = habilitationFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setHabilitationFilter(filter)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded font-medium text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accentText'
                  : 'bg-surface2 text-text border border-border hover:border-accent'
              )}
              data-testid={`filter-pill-${filter}`}
            >
              {labels[filter]}
              <Badge variant={isActive ? 'accent' : 'neutral'} className="text-xs">
                {counts[filter]}
              </Badge>
            </button>
          );
        })}
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH style={{ width: 40 }}></TH>
              <TH>Nom</TH>
              <TH>Prénom</TH>
              <TH>Fonction</TH>
              <TH>Catégorie</TH>
              <TH>Statut habilitation</TH>
              <TH style={{ width: 50, textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map(t => {
              const habilitationStatus = habilitationMap[t.id];
              const badge = habilitationToBadge[habilitationStatus as keyof typeof habilitationToBadge];
              const colors = getAvatarColors(`${t.prenom} ${t.nom}`);
              const initials = getInitials(t.prenom, t.nom);
              return (
                <TR
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(t.id)}
                >
                  <TD>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.bg,
                        color: colors.fg,
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                      data-testid={`avatar-${t.id}`}
                    >
                      {initials}
                    </div>
                  </TD>
                  <TD>{t.nom.toUpperCase()}</TD>
                  <TD>{t.prenom}</TD>
                  <TD className="text-textMuted">{t.fonction}</TD>
                  <TD className="text-textMuted">{t.categorie_reglementaire}</TD>
                  <TD>
                    <Badge variant={badge.variant}>
                      {badge.label}
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
