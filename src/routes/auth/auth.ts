import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  const { usuario, password } = req.body as { usuario?: string; password?: string };

  const appUser = process.env.APP_USER;
  const appPassword = process.env.APP_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  if (!appUser || !appPassword || !jwtSecret) {
    res.status(500).json({ error: 'Configuracion de autenticacion incompleta' });
    return;
  }

  if (usuario !== appUser || password !== appPassword) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const token = jwt.sign({ usuario }, jwtSecret, { expiresIn: '8h' });
  res.status(200).json({ token });
});

export default router;
