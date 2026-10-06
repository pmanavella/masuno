import 'dotenv/config';
import app from './src/app.js';
import { isArcaEnabled } from './src/config/arca.js';

const PORT = process.env.PORT || 3001;

if (process.env.ARCA_MODE) {
  console.warn('ARCA_MODE ya no se usa (no hay modo mock). Sacalo de backend/.env y usá ARCA_ENABLED.');
}

const server = app.listen(PORT, () => {
  console.log(`+1 backend escuchando en http://localhost:${server.address().port}`);
  console.log(`ARCA: ${isArcaEnabled() ? 'habilitado' : 'deshabilitado (ARCA_ENABLED=false)'}`);
});
