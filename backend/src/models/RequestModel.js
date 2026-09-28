import { supabaseForUser } from '../config/supabaseClient.js';
import { mapRpcError } from '../services/eventService.js';

// Todo corre como el usuario: la base decide (RLS + funciones security definer).
async function rpc(accessToken, fn, args) {
  const { data, error } = await supabaseForUser(accessToken).rpc(fn, args);
  if (error) throw mapRpcError(error);
  return data;
}

export const RequestModel = {
  canJoin: (eventId, accessToken) => rpc(accessToken, 'can_join_event', { p_event_id: eventId }),

  requestToJoin: (eventId, accessToken) => rpc(accessToken, 'request_to_join', { p_event_id: eventId }),

  respond: (requestId, accept, accessToken) =>
    rpc(accessToken, 'respond_to_request', { p_request_id: requestId, p_accept: accept }),

  cancel: (requestId, accessToken) => rpc(accessToken, 'cancel_request', { p_request_id: requestId }),

  // Solicitudes de un evento propio con el nombre visible de cada uno ("Juan P.").
  listForEvent: (eventId, accessToken) => rpc(accessToken, 'get_event_requests', { p_event_id: eventId }),

  async getMine(eventId, userId, accessToken) {
    const { data, error } = await supabaseForUser(accessToken)
      .from('event_requests')
      .select('id, status, created_at, responded_at')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listMine(userId, accessToken) {
    const { data, error } = await supabaseForUser(accessToken)
      .from('event_requests')
      .select('id, status, created_at, responded_at, event:events(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};
