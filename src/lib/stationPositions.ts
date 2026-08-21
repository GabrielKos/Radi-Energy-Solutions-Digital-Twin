import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from './supabaseClient';
import { recordAudit } from './auditLog';

/**
 * Shared Floor Twin station positions.
 *
 * Dragging a station used to move it in one browser's memory only — the move
 * was lost on refresh and no colleague ever saw it. Positions now persist to
 * Supabase and arrive live in every open browser, so the team works from one
 * agreed plant layout.
 *
 * Positions are keyed by canvas node id ('W01', 'S_BOT_1', 'CY_14', …), which
 * `buildFactoryModel` generates deterministically, so a saved row keeps
 * matching its station across rebuilds. Rows whose station no longer exists are
 * ignored on load rather than treated as an error: that is what makes editing
 * the machine census safe, since changing the census changes how many stations
 * the layout generates.
 */

export interface StationPosition {
  id: string;
  x: number;
  y: number;
  updatedBy: string;
}

export type StationPositionMap = Record<string, { x: number; y: number }>;

const fromRow = (r: any): StationPosition => ({
  id: r.id,
  x: Number(r.x),
  y: Number(r.y),
  updatedBy: r.updated_by ?? '',
});

export interface UseStationPositionsResult {
  positions: StationPositionMap;
  loading: boolean;
  /**
   * Null unless the table is genuinely unreachable. A missing table (migration
   * 0004 not yet run) is reported here so the banner can say so plainly rather
   * than the feature failing silently.
   */
  error: string | null;
  /** Persist one station's position and record it in the change trail. */
  savePosition: (id: string, x: number, y: number, actorEmail: string, label: string) => Promise<void>;
  /** Drop every saved override, returning the floor to its generated layout. */
  resetAll: (actorEmail: string) => Promise<void>;
}

export function useStationPositions(): UseStationPositionsResult {
  const [positions, setPositions] = useState<StationPositionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Echo suppression. Our own write comes back through the realtime channel a
  // moment later; applying it would be harmless for a finished drag but would
  // fight the operator if they had already started moving the station again.
  const ownWritesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setError(SUPABASE_CONFIG_ERROR);
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: fetchError } = await supabase.from('station_positions').select('*');
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setError(null);
        const map: StationPositionMap = {};
        for (const row of data ?? []) {
          const p = fromRow(row);
          map[p.id] = { x: p.x, y: p.y };
        }
        setPositions(map);
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel('public:station_positions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_positions' }, payload => {
        setPositions(prev => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            if (!(deletedId in prev)) return prev;
            const next = { ...prev };
            delete next[deletedId];
            return next;
          }
          const p = fromRow(payload.new);
          const ownAt = ownWritesRef.current.get(p.id);
          if (ownAt !== undefined && Date.now() - ownAt < 4000) {
            ownWritesRef.current.delete(p.id);
            return prev; // our own move, already applied locally
          }
          const current = prev[p.id];
          if (current && current.x === p.x && current.y === p.y) return prev;
          return { ...prev, [p.id]: { x: p.x, y: p.y } };
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const savePosition = useCallback(
    async (id: string, x: number, y: number, actorEmail: string, label: string) => {
      const rounded = { x: Math.round(x), y: Math.round(y) };
      ownWritesRef.current.set(id, Date.now());
      setPositions(prev => ({ ...prev, [id]: rounded }));

      const { error: upsertError } = await supabase
        .from('station_positions')
        .upsert({ id, x: rounded.x, y: rounded.y, updated_by: actorEmail });

      if (upsertError) {
        setError(upsertError.message);
        throw upsertError;
      }
      setError(null);

      await recordAudit({
        actorEmail,
        action: 'update',
        entity: 'station_positions',
        recordId: id,
        recordLabel: label,
        changes: { position: { from: null, to: `${rounded.x}, ${rounded.y}` } },
      });
    },
    []
  );

  const resetAll = useCallback(async (actorEmail: string) => {
    const { error: deleteError } = await supabase
      .from('station_positions')
      .delete()
      // Postgrest refuses an unfiltered delete; this matches every row.
      .not('id', 'is', null);
    if (deleteError) {
      setError(deleteError.message);
      throw deleteError;
    }
    setPositions({});
    setError(null);
    await recordAudit({
      actorEmail,
      action: 'delete',
      entity: 'station_positions',
      recordId: '*',
      recordLabel: 'All saved station positions',
      changes: {},
    });
  }, []);

  return { positions, loading, error, savePosition, resetAll };
}
