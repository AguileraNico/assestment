import { Router } from 'express';
import { JurisprudenciaController } from '../../controllers/jurisprudencia/jurisprudencia.controller';
import { JurisprudenciaService } from '../../services/jurisprudencia/jurisprudencia.service';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';

const router = Router();

// Dependency injection manual
const repository = new JurisprudenciaRepository();
const service = new JurisprudenciaService(repository);
const controller = new JurisprudenciaController(service);

router.post('/analizar', controller.analizar);
router.post('/documento', controller.obtenerDocumento);

export default router;
