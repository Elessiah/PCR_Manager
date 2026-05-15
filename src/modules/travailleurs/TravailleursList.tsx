import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { habilitationToBadge } from '../../lib/habilitation';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Plus, Search, Pencil } from 'lucide-react';

export default function TravailleursList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const filtered = travailleurs.filter(t => {
    const query = searchQuery.toLowerCase();
    return (
      t.nom.toLowerCase().includes(query) ||
      t.prenom.toLowerCase().includes(query) ||
      (t.fonction?.toLowerCase().includes(query) ?? false)
    );
  });

  const handleRowClick = (id: number) => {
    navigate(`/travailleurs/${id}`);
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

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Prénom</TH>
              <TH>Fonction</TH>
              <TH>Statut habilitation</TH>
              <TH style={{ width: 50, textAlign: 'right' }}>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map(t => {
              const badge = habilitationToBadge['non_validee'];
              return (
                <TR
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(t.id)}
                >
                  <TD>{t.nom.toUpperCase()}</TD>
                  <TD>{t.prenom}</TD>
                  <TD className="text-textMuted">{t.fonction}</TD>
                  <TD>
                    <Badge variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/travailleurs/${t.id}`);
                      }}
                    >
                      <Pencil size={16} />
                    </Button>
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
