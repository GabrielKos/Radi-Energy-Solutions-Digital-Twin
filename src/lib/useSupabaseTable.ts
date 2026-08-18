import { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface TableAdapter<T> {
  table: string;
  orderBy?: string;
  fromRow: (row: any) => T;
  toRow: (item: Partial<T>) => Record<string, any>;
}

export interface UseSupabaseTableResult<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  insert: (item: Omit<T, 'id'> & { id?: string }) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Generic real-time synced hook for any plant entity table.
 * Seamlessly manages local state if Supabase credentials are not present,
 * and activates live multi-user real-time Postgres sync when configured.
 */
export function useSupabaseTable<T extends { id: string }>(
  adapter: TableAdapter<T>,
  fallbackData?: T[]
): UseSupabaseTableResult<T> {
  const [rows, setRows] = useState<T[]>(fallbackData ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const fetchRows = async () => {
    if (!isSupabaseConfigured || !supabase) {
      if (fallbackData && rows.length === 0) setRows(fallbackData);
      return;
    }

    try {
      let query = supabase.from(adapterRef.current.table).select('*');
      if (adapterRef.current.orderBy) query = query.order(adapterRef.current.orderBy);
      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        if (fallbackData && fallbackData.length > 0) setRows(fallbackData);
      } else if (data && data.length > 0) {
        setRows(data.map(adapterRef.current.fromRow));
      } else if (fallbackData && fallbackData.length > 0) {
        setRows(fallbackData);
      }
    } catch (err: any) {
      setError(err.message || 'Error querying table');
      if (fallbackData && fallbackData.length > 0) setRows(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();

    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`realtime:${adapter.table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: adapter.table },
        () => {
          fetchRows();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adapter.table]);

  const insert: UseSupabaseTableResult<T>['insert'] = async item => {
    if (!isSupabaseConfigured || !supabase) {
      const newId = item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newItem = { ...item, id: newId } as unknown as T;
      setRows(prev => [...prev, newItem]);
      return;
    }

    const { error: insertError } = await supabase
      .from(adapter.table)
      .insert(adapter.toRow(item as Partial<T>));
    if (insertError) throw insertError;
  };

  const update: UseSupabaseTableResult<T>['update'] = async (id, patch) => {
    if (!isSupabaseConfigured || !supabase) {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      return;
    }

    const { error: updateError } = await supabase
      .from(adapter.table)
      .update(adapter.toRow(patch))
      .eq('id', id);
    if (updateError) throw updateError;
  };

  const remove: UseSupabaseTableResult<T>['remove'] = async id => {
    if (!isSupabaseConfigured || !supabase) {
      setRows(prev => prev.filter(r => r.id !== id));
      return;
    }

    const { error: deleteError } = await supabase.from(adapter.table).delete().eq('id', id);
    if (deleteError) throw deleteError;
  };

  return { rows, loading, error, insert, update, remove, refresh: fetchRows };
}
