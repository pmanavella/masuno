import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`+1 backend escuchando en http://localhost:${PORT}`);
});
