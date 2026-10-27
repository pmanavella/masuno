import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { NotificationsContext } from '../context/NotificationsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/apiClient.js';
import { DEMO_BASENAME, DEMO_UNAVAILABLE_MESSAGE } from '../lib/demoMode.js';
import { notificationText } from '../lib/events.js';
import { DEMO_USER } from './demoData.js';
import { subscribe, unreadCount } from './demoApi.js';

const unavailable = () => Promise.resolve({ error: new Error(DEMO_UNAVAILABLE_MESSAGE) });

// Misma forma que AuthProvider, con el usuario ficticio ya confirmado. No toca Supabase.
const demoAuth = {
  session: null,
  user: DEMO_USER,
  loading: false,
  emailConfirmed: true,
  signIn: unavailable,
  signInWithGoogle: unavailable,
  // Recarga /demo: se reinician los datos y vuelve la bienvenida.
  signOut: async () => {
    window.location.assign(DEMO_BASENAME);
  },
};

export function DemoAuthProvider({ children }) {
  return <AuthContext.Provider value={demoAuth}>{children}</AuthContext.Provider>;
}

// Misma interfaz que NotificationsProvider; los avisos llegan de demoApi en vez de Realtime.
export function DemoNotificationsProvider({ children }) {
  const showToast = useToast();
  const [unread, setUnread] = useState(unreadCount);
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      subscribe(({ notification }) => {
        setUnread(unreadCount());
        setVersion((v) => v + 1);
        showToast(notificationText(notification.type, notification.event?.title));
      }),
    [showToast]
  );

  const refresh = useCallback(async () => setUnread(unreadCount()), []);

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
