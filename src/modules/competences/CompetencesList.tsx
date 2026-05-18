import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CompetenceRef } from '../../types/domain';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Label, Input } from '../../components/ui/FormField';
import { Plus, Search } from 'lucide-react';

type ModalMode = { type: 'create' } | { type: 'edit'; competence: CompetenceRef };

function CompetenceModal({
  mode,
  onClose,
  nextOrdre,
}: {
  mode: ModalMode;
  onClose: () => void;
  nextOrdre: number;
}) {
  const qc = useQueryClient();
  const [libelle, setLibelle] = useState(mode.type === 'edit' ? mode.competence.libelle : '');
  const [description, setDescription] = useState(mode.type === 'edit' ? mode.competence.description ?? '' : '');
  const [propreAppareil, setPropreAppareil] = useState(
    mode.type === 'edit' ? mode.competence.propre_appareil === 1 : true
  );
  const [permanente, setPermanente] = useState(
    mode.type === 'edit' ? mode.competence.duree_validite_mois === null : false
  );
  const [dureeMois, setDureeMois] = useState(
    mode.type === 'edit' && mode.competence.duree_validite_mois !== null
      ? String(mode.competence.duree_validite_mois)
      : ''
  );
  const [alerteMois, setAlerteMois] = useState(
    mode.type === 'edit' ? String(mode.competence.duree_alerte_mois) : '3'
  );

  const isValid = (): boolean => {
    if (!libelle.trim()) return false;
    if (!permanente) {
      const d = Number(dureeMois);
      const a = Number(alerteMois);
      if (isNaN(d) || d < 1) return false;
      if (isNaN(a) || a < 1) return false;
      if (a > d) return false;
    }
    return true;
  };

  const createMut = useMutation({
    mutationFn: () => api.competence.refCreate({
      libelle,
      ordre: nextOrdre,
      description: description || null,
      propreAppareil: propreAppareil ? 1 : 0,
      dureeValiditeMois: permanente ? null : Number(dureeMois),
      dureeAlerteMois: permanente ? 0 : Number(alerteMois),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competences'] }); onClose(); },
  });
  const updateMut = useMutation({
    mutationFn: () => {
      if (mode.type !== 'edit') return Promise.resolve();
      return api.competence.refUpdate({
        id: mode.competence.id,
        libelle,
        ordre: mode.competence.ordre,
        description: description || null,
        propreAppareil: propreAppareil ? 1 : 0,
        dureeValiditeMois: permanente ? null : Number(dureeMois),
        dureeAlerteMois: permanente ? 0 : Number(alerteMois),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competences'] }); onClose(); },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;
    if (mode.type === 'create') createMut.mutate();
    else updateMut.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold">
          {mode.type === 'create' ? 'Ajouter une compétence' : 'Modifier la compétence'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <Label htmlFor="libelle">Libellé</Label>
            <Input
              id="libelle"
              value={libelle}
              onChange={e => setLibelle(e.target.value)}
              placeholder="Ex : Mise sous tension de l'appareil"
              autoFocus
            />
          </Field>
          <Field>
            <Label htmlFor="description">Description (facultative)</Label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Détails ou notes additionnelles…"
              className="border border-border rounded px-3 py-2 w-full text-sm resize-none"
              rows={3}
            />
          </Field>
          <Field>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={propreAppareil}
                onChange={e => setPropreAppareil(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Propre à l'appareil</span>
            </label>
          </Field>
          <Field>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={permanente}
                onChange={e => setPermanente(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Durée de validité permanente</span>
            </label>
          </Field>
          {!permanente && (
            <Field>
              <Label htmlFor="dureeMois">Durée de validité (mois)</Label>
              <Input
                id="dureeMois"
                type="number"
                value={dureeMois}
                onChange={e => setDureeMois(e.target.value)}
                min={1}
              />
            </Field>
          )}
          <Field>
            <Label htmlFor="alerteMois">Alerte avant péremption (mois)</Label>
            <Input
              id="alerteMois"
              type="number"
              value={alerteMois}
              onChange={e => setAlerteMois(e.target.value)}
              min={1}
              disabled={permanente}
              max={permanente ? undefined : Number(dureeMois)}
            />
          </Field>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending || !isValid()}>
              {isPending ? 'Enregistrement…' : mode.type === 'create' ? 'Ajouter' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ competence, onClose }: { competence: CompetenceRef; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => api.competence.refDelete(competence.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competences'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold">Supprimer la compétence ?</h2>
        <p className="text-textSoft text-[14px]">
          <strong>{competence.libelle}</strong> sera supprimée définitivement.
          Les validations de compétences des travailleurs associées seront également supprimées.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            variant="dangerGhost"
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CompetencesList() {
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompetenceRef | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: competences = [], isLoading, error } = useQuery({
    queryKey: ['competences'],
    queryFn: () => api.competence.list(),
  });

  const nextOrdre = competences.length > 0 ? Math.max(...competences.map(c => c.ordre)) + 1 : 1;

  const normalize = (str: string) =>
    str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  const filtered = competences.filter(c => {
    const searchLower = normalize(debouncedSearch);
    return (
      normalize(c.libelle).includes(searchLower) ||
      (c.description && normalize(c.description).includes(searchLower))
    );
  });

  const sorted = [...filtered].sort((a, b) =>
    a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' })
  );

  const displayed = sorted.slice(0, displayLimit);
  const remaining = sorted.length - displayLimit;

  return (
    <>
      <PageHead
        title="Bibliothèque de compétences"
        sub="Gérez les compétences radioprotection de votre établissement"
        actions={
          <Button variant="primary" onClick={() => setModal({ type: 'create' })}>
            <Plus size={14} />
            Ajouter une compétence
          </Button>
        }
      />

      <div className="p-6">
        <Card>
          {isLoading && (
            <div className="p-8 text-center text-textSoft text-[14px]">Chargement…</div>
          )}
          {error && (
            <div className="p-8 text-center text-danger text-[14px]">Erreur de chargement</div>
          )}
          {!isLoading && !error && (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-border">
                <Search size={18} className="text-textSoft flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par libellé ou description…"
                  className="flex-1 px-3 py-2 border border-border rounded text-sm bg-background"
                />
                <span className="text-textSoft text-sm whitespace-nowrap flex-shrink-0">
                  {filtered.length} {filtered.length === 1 ? 'compétence' : 'compétences'} (sur {competences.length})
                </span>
              </div>

              <Table>
                <THead className="sticky top-0 bg-surface z-10">
                  <TR>
                    <TH>Libellé</TH>
                    <TH>Validité</TH>
                    <TH>Alerte</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {displayed.length === 0 && (
                    <TR>
                      <TD colSpan={4}>
                        <span className="text-textSoft text-[13px]">
                          {search ? 'Aucun résultat' : 'Aucune compétence définie'}
                        </span>
                      </TD>
                    </TR>
                  )}
                  {displayed.map(c => (
                    <TR key={c.id}>
                      <TD>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[14px]">{c.libelle}</span>
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${
                              c.propre_appareil === 1
                                ? 'border-primary text-primary'
                                : 'border-border text-textSoft'
                            }`}>
                              {c.propre_appareil === 1 ? 'Propre' : 'Générale'}
                            </span>
                          </div>
                          {c.description && (
                            <div className="text-textSoft text-xs mt-0.5">{c.description}</div>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <span className="text-[13px]">
                          {c.duree_validite_mois === null ? 'Permanente' : `${c.duree_validite_mois} mois`}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-[13px]">
                          {c.duree_validite_mois === null ? '—' : `${c.duree_alerte_mois} mois`}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => setModal({ type: 'edit', competence: c })}
                          >
                            Éditer
                          </Button>
                          <Button
                            variant="dangerGhost"
                            onClick={() => setDeleteTarget(c)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {remaining > 0 && (
                <div className="p-4 border-t border-border text-center">
                  <Button
                    variant="ghost"
                    onClick={() => setDisplayLimit(prev => prev + 50)}
                  >
                    Afficher 50 de plus ({remaining} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {modal && <CompetenceModal mode={modal} onClose={() => setModal(null)} nextOrdre={nextOrdre} />}
      {deleteTarget && (
        <DeleteConfirmModal competence={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
