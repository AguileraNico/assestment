import { Router } from 'express';
import { EmbeddingsController } from '../../controllers/embeddings/embeddings.controller';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';

const router = Router();

// Singleton del vector store — exportado para ser compartido con analisis
export const embeddingsRepository = new EmbeddingsRepository();
const jurisprudenciaRepository = new JurisprudenciaRepository();
const service = new EmbeddingsService(jurisprudenciaRepository, embeddingsRepository);
const controller = new EmbeddingsController(service);

router.post('/generar', controller.generar);
router.post('/buscar', controller.buscarSimilares);

export default router;
