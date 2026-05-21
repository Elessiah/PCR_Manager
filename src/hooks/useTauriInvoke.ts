import { invoke } from '@tauri-apps/api/core'
import { useCallback } from 'react'

/**
 * Hook personnalisé pour invoquer les commandes Tauri
 * Simplifie les appels aux handlers Rust
 */
export function useTauriInvoke() {
  return useCallback(async <T,>(command: string, args?: Record<string, unknown>): Promise<T> => {
    return invoke<T>(command, args)
  }, [])
}

/**
 * Hook pour accéder à la base de données Tauri
 */
export function useTauriDB() {
  const invoke = useTauriInvoke()

  return {
    // Requêtes à implémenter selon schema.sql
    query: async (sql: string, params?: unknown[]) => {
      return invoke('db_query', { sql, params })
    },
    execute: async (sql: string, params?: unknown[]) => {
      return invoke('db_execute', { sql, params })
    },
  }
}
