import { Router } from 'express';
import { AnalisisController } from '../../controllers/analisis/analisis.controller';
import { AnalisisService } from '../../services/analisis/analisis.service';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';
import { embeddingsRepository } from '../embeddings/embeddings';

const router = Router();

// Reutilizamos el mismo embeddingsRepository singleton que tiene el vector store cargado
const analisisRepository = new AnalisisRepository();
const jurisprudenciaRepository = new JurisprudenciaRepository();
const service = new AnalisisService(embeddingsRepository, analisisRepository, jurisprudenciaRepository);
const controller = new AnalisisController(service);

router.post('/analizar', controller.analizar);

export default router;
