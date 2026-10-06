import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { api } from '../lib/apiClient.js';
import { notificationText } from '../lib/events.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const NotificationsContext = createContext(null);

// Avisos de la cuenta habilitada (email confirmado): contador de no leídos y suscripción a Realtime.
// Realtime aplica RLS, así que el canal solo recibe los avisos propios; el filtro por
// user_id es para no procesar de más.
export function NotificationsProvider({ children }) {
  const { user, emailConfirmed } = useAuth();
  const showToast = useToast();
  const [unread, setUnread] = useState(0);
  // Cambia con cada aviso nuevo: las pantallas lo usan para recargar (solicitudes, estados).
  const [version, setVersion] = useState(0);
  const userId = user?.id ?? null;
  const enabled = userId !== null && emailConfirmed;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await api.getNotifications();
      setUnread(list.filter((n) => !n.read_at).length);
    } catch {
      // El contador es informativo: si falla, se reintenta en el próximo aviso.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return undefined;
    }
    let channel = null;
    let cancelled = false;

    (async () => {
      // Sin el token del usuario, Realtime evalúa RLS como anónimo y no entrega nada: se pasa
      // explícito antes de suscribirse (si no, puede ganar la carrera con la restauración de sesión).
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          async (payload) => {
            setUnread((n) => n + 1);
            setVersion((v) => v + 1);
            const { data: event } = await supabase.from('events').select('title').eq('id', payload.new.event_id).maybeSingle();
            showToast(notificationText(payload.new.type, event?.title));
          }
        )
        .subscribe((status) => {
          // Al suscribirse (y al reconectar) se recarga, por si llegó algo mientras no había canal.
          if (status === 'SUBSCRIBED') {
            refresh();
            setVersion((v) => v + 1);
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, userId, refresh, showToast]);

  const markAllRead = useCallback(async () => {
    await api.markNotificationsRead();
    setUnread(0);
  }, []);

  return (
    <NotificationsContext.Provider value={{ unread, version, refresh, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
