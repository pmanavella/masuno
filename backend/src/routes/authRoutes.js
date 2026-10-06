import { Router } from 'express';
import { register } from '../controllers/authController.js';

const router = Router();

// Público: crea la cuenta (Supabase Auth) con los datos declarados. El login sigue siendo con
// Supabase Auth directo desde el frontend.
router.post('/register', register);

export default router;
