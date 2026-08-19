import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface TableAdapter<T extends { id: string }> {
  table: string;
  fromRow: (row: any) => T;
  toRow: (item: Partial<T>) => any;
  orderBy?: string;
}

export interface UseSupabaseTableResult<T extends { id: string }> {
  rows: T[];
  loading: boolean;
  error: string | null;
  insert: (item: Omit<T, 'id'> & { id?: string }) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Re-read the table. Needed after a bulk seed, which realtime may batch. */
  refetch: () => void;
}

/**
 * One hook, reused by every editable collection (warehouses, workforce,
 * tariff periods, capex items, and — via a thin wrapper — machines).
 * Loads the current rows once, then keeps them in sync live via a Postgres
 * changes subscription so every open tab reflects every other collaborator's
 * edits without a manual refresh.
 */
export function useSupabaseTable<T extends { id: string }>(
  adapter: TableAdapter<T>,
  fallbackRows?: () => T[]
): UseSupabaseTableResult<T> {
  const [rows, setRows] = useState<T[]>(() => (fallbackRows ? fallbackRows() : []));
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const refetch = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (fallbackRows) {
        setRows(fallbackRows());
      }
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    (async () => {
      let query = supabase.from(adapter.table).select('*');
      if (adapter.orderBy) query = query.order(adapter.orderBy);
      const { data, error: fetchError } = await query;
      if (!active) return;
      if (fetchError) {
        // If query fails (e.g. invalid permissions/network), fallback gracefully to local seed if provided
        if (fallbackRows && (!rows || rows.length === 0)) {
          setRows(fallbackRows());
        }
        setError(fetchError.message);
      } else {
        if (data && data.length > 0) {
          setRows(data.map(adapterRef.current.fromRow));
        } else if (fallbackRows && (!rows || rows.length === 0)) {
          setRows(fallbackRows());
        } else {
          setRows([]);
        }
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`public:${adapter.table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: adapter.table }, payload => {
        setRows(prev => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            return prev.filter(r => r.id !== deletedId);
          }
          const incoming = adapterRef.current.fromRow(payload.new);
          const exists = prev.some(r => r.id === incoming.id);
          return exists ? prev.map(r => (r.id === incoming.id ? incoming : r)) : [...prev, incoming];
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.table, reloadKey]);

  // Every mutation below also applies its own result to local state rather than
  // waiting for the change to come back around through the realtime channel.
  const insert: UseSupabaseTableResult<T>['insert'] = async item => {
    if (!isSupabaseConfigured) {
      const newId = item.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newRow = { ...item, id: newId } as T;
      setRows(prev => [...prev, newRow]);
      return;
    }
    const { data, error: insertError } = await supabase
      .from(adapter.table)
      .insert(adapter.toRow(item as Partial<T>))
      .select();
    if (insertError) throw insertError;

    const created = (data ?? []).map(adapterRef.current.fromRow);
    if (created.length) {
      setRows(prev => {
        const known = new Set(prev.map(r => r.id));
        return [...prev, ...created.filter((r: T) => !known.has(r.id))];
      });
    } else {
      refetch();
    }
  };

  const update: UseSupabaseTableResult<T>['update'] = async (id, patch) => {
    if (!isSupabaseConfigured) {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      return;
    }
    const { error: updateError } = await supabase.from(adapter.table).update(adapter.toRow(patch)).eq('id', id);
    if (updateError) throw updateError;
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove: UseSupabaseTableResult<T>['remove'] = async id => {
    if (!isSupabaseConfigured) {
      setRows(prev => prev.filter(r => r.id !== id));
      return;
    }
    const { error: deleteError } = await supabase.from(adapter.table).delete().eq('id', id);
    if (deleteError) throw deleteError;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return { rows, loading, error, insert, update, remove, refetch };
}
