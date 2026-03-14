import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import jurisprudenciaRouter from './routes/jurisprudencia/jurisprudencia';
import embeddingsRouter from './routes/embeddings/embeddings';
import analisisRouter from './routes/analisis/analisis';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/jurisprudencia', jurisprudenciaRouter);
app.use('/embeddings', embeddingsRouter);
app.use('/analisis', analisisRouter);

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
