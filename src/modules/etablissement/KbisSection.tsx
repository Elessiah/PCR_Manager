import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHead, CardTitle } from '../../components/ui/Card';
import { Field, Label, Input } from '../../components/ui/FormField';
import type { Etablissement } from '../../types/domain';
import { api } from '../../lib/api';

interface KbisSectionProps {
  etablissement: Etablissement;
  isEditing?: boolean;
}

export default function KbisSection({
  etablissement,
  isEditing = false,
}: KbisSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [siret, setSiret] = useState(etablissement.siret || '');
  const [siretError, setSiretError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    uploadedAt: string;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const errorMsg = validateSiret(siret);
      if (errorMsg) {
        setSiretError(errorMsg);
        throw new Error(errorMsg);
      }

      return api.document.upload({
        entityType: 'etablissement',
        entityId: etablissement.id,
        typeDocument: 'kbis',
        nomFichier: file.name,
        sourcePath: file.name,
      });
    },
    onSuccess: doc => {
      setUploadedFile({
        name: doc.nom_fichier,
        uploadedAt: doc.uploaded_at,
      });
      setSiretError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: err => {
      console.error('Upload failed:', err);
    },
  });

  const validateSiret = (value: string): string | null => {
    if (!value) return null;
    if (value.length !== 14) {
      return 'Le SIRET doit contenir exactement 14 chiffres';
    }
    if (!/^\d+$/.test(value)) {
      return 'Le SIRET doit contenir uniquement des chiffres';
    }
    return null;
  };

  const handleSiretChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setSiret(cleanValue);
    if (cleanValue) {
      setSiretError(validateSiret(cleanValue));
    } else {
      setSiretError(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setSiretError('Le fichier doit être un PDF');
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  return (
    <Card>
      <CardHead>
        <CardTitle>Document K-Bis</CardTitle>
      </CardHead>
      <CardBody className="space-y-4">
        {/* SIRET Display/Edit */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Field>
              <Label>Numéro SIRET</Label>
              {isEditing ? (
                <>
                  <Input
                    value={siret}
                    onChange={e => handleSiretChange(e.target.value)}
                    maxLength={14}
                    placeholder="14 chiffres"
                    className="font-mono"
                  />
                  {siretError && (
                    <p className="text-xs text-danger mt-1">{siretError}</p>
                  )}
                </>
              ) : (
                <div className="px-3 py-2 bg-surface2 border border-border rounded text-sm text-text font-mono">
                  {siret || '—'}
                </div>
              )}
            </Field>
          </div>
          {!isEditing && siret && !siretError && (
            <div className="px-3 py-1 bg-accentSoft text-accent text-xs font-medium rounded">
              Valide
            </div>
          )}
        </div>

        {/* File Upload Section */}
        <div className="border border-dashed border-border rounded-lg p-6 text-center bg-surface2">
          {uploadedFile ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-12 h-16 bg-danger/10 rounded flex items-center justify-center text-danger text-xs font-bold">
                  PDF
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-text">{uploadedFile.name}</p>
                <p className="text-xs text-textMuted mt-1">
                  Mis à jour le {new Date(uploadedFile.uploadedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                {isEditing && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? 'Chargement...' : 'Remplacer'}
                  </Button>
                )}
                <Button size="sm" variant="primary">
                  Télécharger
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-textMuted">
                Aucun document K-Bis chargé
              </p>
              {isEditing && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending || !!siretError}
                >
                  {uploadMutation.isPending ? 'Chargement...' : 'Charger le PDF'}
                </Button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploadMutation.isPending}
          />
        </div>

        {uploadMutation.isError && (
          <p className="text-sm text-danger">
            Erreur lors du chargement du fichier
          </p>
        )}
      </CardBody>
    </Card>
  );
}
