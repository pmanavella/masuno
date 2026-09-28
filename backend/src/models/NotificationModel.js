import { supabaseForUser } from '../config/supabaseClient.js';

export const NotificationModel = {
  // RLS: cada uno ve solo los suyos.
  async list(accessToken) {
    const { data, error } = await supabaseForUser(accessToken)
      .from('notifications')
      .select('id, type, event_id, request_id, read_at, created_at, event:events(title, starts_at)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  // La base solo deja actualizar read_at (permiso por columna).
  async markAllRead(accessToken) {
    const { error } = await supabaseForUser(accessToken)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    if (error) throw error;
  },
};
