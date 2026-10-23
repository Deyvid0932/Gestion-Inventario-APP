import { supabase } from '../database/supabase';

const PAGE_SIZE = 500;

/**
 * Descarga una tabla completa en páginas estables. Evita que el límite de
 * respuesta de Supabase deje fuera prendas o fotos sin producir un error.
 */
export async function fetchRemotePages(
  table: string,
  configure?: (query: any) => any
): Promise<any[] | null> {
  const rows: any[] = [];

  try {
    for (let from = 0; ; from += PAGE_SIZE) {
      let query: any = supabase.from(table).select('*');
      if (configure) query = configure(query);
      query = query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) {
        console.error(`[SYNC_PULL] Error descargando ${table}:`, error);
        return null;
      }

      const page = data || [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  } catch (e) {
    console.error(`[SYNC_PULL] Excepción descargando ${table}:`, e);
    return null;
  }
}
