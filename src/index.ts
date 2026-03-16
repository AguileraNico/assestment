import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jurisprudenciaRouter from './routes/jurisprudencia/jurisprudencia';
import embeddingsRouter from './routes/embeddings/embeddings';
import analisisRouter from './routes/analisis/analisis';
import authRouter from './routes/auth/auth';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middlewares
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean)
    : true; // en dev acepta cualquier origen

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas públicas
app.use('/auth', authRouter);

// Rutas protegidas — solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use('/jurisprudencia', authMiddleware, jurisprudenciaRouter);
  app.use('/embeddings', authMiddleware, embeddingsRouter);
}

// Rutas protegidas — disponibles en todos los entornos
app.use('/analisis', authMiddleware, analisisRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
