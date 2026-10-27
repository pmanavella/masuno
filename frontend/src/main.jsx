import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import { DEMO_MODE } from './lib/demoMode.js';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (DEMO_MODE) {
  // Import dinámico: los datos y proveedores de la demo quedan en un chunk aparte que la app
  // real nunca descarga.
  import('./demo/DemoRoot.jsx').then(({ DemoRoot }) => {
    root.render(
      <React.StrictMode>
        <DemoRoot />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
