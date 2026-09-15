import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Reusa public/favicon.png de la raíz del monorepo en vez de duplicarlo.
  publicDir: path.resolve(__dirname, '../public'),
});
