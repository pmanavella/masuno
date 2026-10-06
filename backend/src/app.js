import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { allowedOrigins } from './config/origins.js';

const app = express();

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

app.use(errorHandler);

export default app;
