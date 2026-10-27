import { BrowserRouter } from 'react-router-dom';
import App from '../App.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { installDemoApi } from '../lib/apiClient.js';
import { DEMO_BASENAME } from '../lib/demoMode.js';
import { demoApi } from './demoApi.js';
import { DemoAuthProvider, DemoNotificationsProvider } from './DemoProviders.jsx';
import { DemoBanner } from './DemoBanner.jsx';

// Antes del primer render: desde acá ninguna pantalla llega al backend real.
installDemoApi(demoApi);

// Las mismas pantallas de la app bajo /demo: con el basename, los Link y navigate('/crear')
// de cada pantalla quedan en /demo/crear sin tocarlas.
export function DemoRoot() {
  return (
    <BrowserRouter basename={DEMO_BASENAME}>
      <ToastProvider>
        <DemoAuthProvider>
          <DemoNotificationsProvider>
            <App demoBanner={<DemoBanner />} />
          </DemoNotificationsProvider>
        </DemoAuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
