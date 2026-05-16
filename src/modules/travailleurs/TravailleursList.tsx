import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Plus, Search, ChevronRight } from 'lucide-react';

type HabilitationFilter = 'tous' | 'validee' | 'partielle' | 'non_validee';

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className="inline-grid place-items-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `oklch(0.92 0.04 ${hue})`, color: `oklch(0.45 0.15 ${hue})`, fontSize: size * 0.4 }}
      data-testid={`avatar-${name}`}
    >{initials}</span>
  );
}

export default function TravailleursList() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<HabilitationFilter>('tous');
  const { data: travailleurs = [] } = useQuery({
    queryKey: ['travailleurs'],
    queryFn: () => api.travailleur.list(),
  });

  const habilitationQueries = useQueries({
    queries: travailleurs.map(t => ({
      queryKey: ['habilitation', t.id],
      queryFn: () => api.habilitation.compute(t.id),
      staleTime: 60_000,
    })),
  });

  const habilitations = useMemo(() => {
    const map: Record<number, string> = {};
    travailleurs.forEach((t, i) => {
      map[t.id] = habilitationQueries[i]?.data?.statut ?? 'non_validee';
    });
    return map;
  }, [travailleurs, habilitationQueries]);

  const filters = [
    { value: 'tous' as const, label: 'Tous', count: travailleurs.length },
    { value: 'validee' as const, label: 'Validée', count: Object.values(habilitations).filter(v => v === 'validee').length },
    { value: 'partielle' as const, label: 'Partielle', count: Object.values(habilitations).filter(v => v === 'partielle').length },
    { value: 'non_validee' as const, label: 'Non validée', count: Object.values(habilitations).filter(v => v === 'non_validee').length },
  ];

  const filtered = useMemo(() => travailleurs.filter(t => {
    const matchSearch = !q || [t.nom, t.prenom, t.fonction].some(x => x?.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = filter === 'tous' || habilitations[t.id] === filter;
    return matchSearch && matchStatus;
  }), [travailleurs, q, filter, habilitations]);

  const habToVariant = (s: string) => s === 'validee' ? 'ok' : s === 'partielle' ? 'warn' : 'danger';
  const habToLabel = (s: string) => s === 'validee' ? 'Validée' : s === 'partielle' ? 'Partielle' : 'Non validée';

  return (
    <div className="space-y-4">
      <PageHead
        title="Travailleurs"
        sub={`${travailleurs.length} personnes suivies`}
        actions={<button onClick={() => {}} className="btn-primary"><Plus size={14}/> Ajouter un travailleur</button>}
      />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface border border-border rounded px-2.5 py-1.5 w-[320px]">
          <Search size={14} className="text-textSoft"/>
          <input type="text" placeholder="Rechercher par nom, prénom, fonction…" value={q} onChange={e => setQ(e.target.value)} className="bg-transparent border-0 outline-0 flex-1 text-[13px] placeholder:text-textSoft"/>
        </div>
        <div className="inline-flex bg-surface2 border border-border rounded p-[3px] gap-[2px]">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`border-0 px-[11px] py-[5px] font-semibold text-[12.5px] rounded-sm ${
                filter === f.value ? 'bg-surface text-text shadow-sm' : 'bg-transparent text-textMuted'
              }`}
              data-testid={`filter-pill-${f.value}`}>
              {f.label} <span className="font-mono text-[11.5px] opacity-60 ml-1.5">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1"/>
        <span className="text-textSoft font-mono text-[12.5px]">{filtered.length} résultats</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="w-10"><input type="checkbox"/></TH>
              <TH>Nom</TH>
              <TH>Prénom</TH>
              <TH>Fonction</TH>
              <TH>Catégorie</TH>
              <TH>Habilitation</TH>
              <TH className="w-12"/>
            </TR>
          </THead>
          <TBody>
            {filtered.map(t => {
              const hab = habilitations[t.id];
              return (
                <TR key={t.id} className="cursor-pointer" onClick={() => navigate(`/travailleurs/${t.id}`)}>
                  <TD onClick={e => e.stopPropagation()}><input type="checkbox"/></TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar name={`${t.prenom} ${t.nom}`} size={28}/>
                      <span className="font-semibold uppercase">{t.nom}</span>
                    </div>
                  </TD>
                  <TD>{t.prenom}</TD>
                  <TD className="text-textMuted">{t.fonction}</TD>
                  <TD><Badge variant="neutral" icon={null}>Cat. {t.categorie_reglementaire ?? '—'}</Badge></TD>
                  <TD><Badge variant={habToVariant(hab)}>{habToLabel(hab)}</Badge></TD>
                  <TD className="text-right"><ChevronRight size={14} className="text-textSoft"/></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
