import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../api';
import { invoke } from '@tauri-apps/api/core';

vi.mocked(invoke);

describe('api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  describe('ping', () => {
    it('should call invoke with ping command', async () => {
      vi.mocked(invoke).mockResolvedValue('pong');
      const result = await api.ping();
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('ping');
      expect(result).toBe('pong');
    });
  });

  describe('db', () => {
    it('should call invoke with init_db command', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.db.init();
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('init_db');
    });
  });

  describe('etablissement', () => {
    it('should call invoke with etablissement_list', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.etablissement.list();
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('etablissement_list');
    });

    it('should call invoke with etablissement_get for get method', async () => {
      vi.mocked(invoke).mockResolvedValue({ id: 1 });
      await api.etablissement.get(1);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('etablissement_get', { id: 1 });
    });

    it('should call invoke with etablissement_create for create method', async () => {
      vi.mocked(invoke).mockResolvedValue(1);
      const input = { denomination: 'Test Corp' };
      await api.etablissement.create(input);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('etablissement_create', input);
    });
  });

  describe('travailleur', () => {
    it('should call invoke with travailleur_list', async () => {
      vi.mocked(invoke).mockResolvedValue([]);
      await api.travailleur.list();
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('travailleur_list');
    });

    it('should call invoke with travailleur_get for get method', async () => {
      vi.mocked(invoke).mockResolvedValue({ id: 1 });
      await api.travailleur.get(1);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('travailleur_get', { id: 1 });
    });

    it('should call invoke with travailleur_create for create method', async () => {
      vi.mocked(invoke).mockResolvedValue(1);
      const input = {
        etablissementId: 1,
        nom: 'Dupont',
        prenom: 'Jean',
      };
      await api.travailleur.create(input);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('travailleur_create', input);
    });
  });

  describe('habilitation', () => {
    it('should call invoke with habilitation_compute', async () => {
      vi.mocked(invoke).mockResolvedValue({
        statut: 'validee',
        details: {
          formation_rp_ok: true,
          dosimetries_ok: true,
          competences_ok: true,
          visite_med_ok: true,
        },
      });
      await api.habilitation.compute(1);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('habilitation_compute', {
        travailleurId: 1,
      });
    });
  });
});
