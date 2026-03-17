import { Router } from 'express';
import { AnalisisController } from '../../controllers/analisis/analisis.controller';
import { AnalisisService } from '../../services/analisis/analisis.service';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { embeddingsRepository } from '../embeddings/embeddings';

const router = Router();

// Reutilizamos el mismo embeddingsRepository singleton que tiene el vector store cargado
const analisisRepository = new AnalisisRepository();
const service = new AnalisisService(embeddingsRepository, analisisRepository);
const controller = new AnalisisController(service);

router.post('/analizar', controller.analizar);

export default router;
