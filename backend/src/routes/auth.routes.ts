import { Router } from 'express';
import { register, login, changePassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);

// Protected routes
router.post('/change-password', requireAuth, changePassword);

// Logout is handled client-side (JWT is stateless)
router.post('/logout', (_req, res) => {
  res.status(200).json({ message: 'Logged out. Clear your token on the client.' });
});

export default router;
