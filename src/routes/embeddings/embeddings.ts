import { Router } from 'express';
import { EmbeddingsController } from '../../controllers/embeddings/embeddings.controller';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';

const router = Router();

// Singleton del vector store — exportado para ser compartido con analisis
export const embeddingsRepository = new EmbeddingsRepository();
const service = new EmbeddingsService(embeddingsRepository);
const controller = new EmbeddingsController(service);

router.post('/consultar', controller.consultarRegistrosSCBA);
router.post('/generar', controller.consultarRegistrosSCBA);
router.post('/documento', controller.consultarDocumentoSCBA);
router.post('/preparar-rag', controller.prepararRAG);

export default router;
