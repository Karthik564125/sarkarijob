import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getProfile,
  updateProfile,
  updateAccountInfo,
  updateEducation10th,
  updateEducation12th,
  updateEducationGraduation,
} from '../controllers/profile.controller.js';

const router = Router();

// All profile routes require a valid JWT
router.use(requireAuth);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/account', updateAccountInfo);
router.put('/education/10th', updateEducation10th);
router.put('/education/12th', updateEducation12th);
router.put('/education/graduation', updateEducationGraduation);

export default router;
