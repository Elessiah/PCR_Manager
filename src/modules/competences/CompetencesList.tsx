import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { CompetenceRef } from '../../types/domain';
import { PageHead } from '../../components/ui/PageHead';
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Label, Input } from '../../components/ui/FormField';
import { Plus } from 'lucide-react';

type ModalMode = { type: 'create' } | { type: 'edit'; competence: CompetenceRef };

function CompetenceModal({
  mode,
  onClose,
}: {
  mode: ModalMode;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const initial = mode.type === 'edit' ? mode.competence : { libelle: '', ordre: 0 };
  const [libelle, setLibelle] = useState(initial.libelle);
  const [ordre, setOrdre] = useState(String(initial.ordre));

  const createMut = useMutation({
    mutationFn: () => api.competence.refCreate({ libelle, ordre: Number(ordre) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competences'] }); onClose(); },
  });
  const updateMut = useMutation({
    mutationFn: () => {
      if (mode.type !== 'edit') return Promise.resolve();
      return api.competence.refUpdate({ id: mode.competence.id, libelle, ordre: Number(ordre) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['competences'] }); onClose(); },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!libelle.trim()) return;
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
            <Label htmlFor="ordre">Ordre</Label>
            <Input
              id="ordre"
              type="number"
              value={ordre}
              onChange={e => setOrdre(e.target.value)}
              min={0}
            />
          </Field>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending || !libelle.trim()}>
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

  const { data: competences = [], isLoading, error } = useQuery({
    queryKey: ['competences'],
    queryFn: () => api.competence.list(),
  });

  const sorted = [...competences].sort((a, b) => a.ordre - b.ordre);

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
            <Table>
              <THead>
                <TR>
                  <TH>Ordre</TH>
                  <TH>Libellé</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {sorted.length === 0 && (
                  <TR>
                    <TD colSpan={3}>
                      <span className="text-textSoft text-[13px]">Aucune compétence définie</span>
                    </TD>
                  </TR>
                )}
                {sorted.map(c => (
                  <TR key={c.id}>
                    <TD>
                      <span className="font-mono text-[13px] text-textSoft">{c.ordre}</span>
                    </TD>
                    <TD>
                      <span className="font-semibold text-[14px]">{c.libelle}</span>
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
          )}
        </Card>
      </div>

      {modal && <CompetenceModal mode={modal} onClose={() => setModal(null)} />}
      {deleteTarget && (
        <DeleteConfirmModal competence={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  );
}
