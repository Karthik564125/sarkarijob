import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getRecruitments,
  getUserApplications,
  saveApplicationDecision,
  evaluateMatch,
  getUserMatches,
  getRelevantRecruitments,
  getRecruitmentDetail,
  getDashboardSummary,
  getOpenRecruitments,
  getUserEvents,
  triggerMonitoringRun,
  checkNow,
  triggerSSCCollection,
  triggerAPPSCCollection,
  triggerRRBCollection,
} from '../controllers/recruitment.controller.js';

const router = Router();

// Protect all recruitment routes with JWT authentication
router.use(requireAuth);

// ─── 1. General list endpoint ──────────────────────────────────────────
router.get('/', getRecruitments);

// ─── 2. Monitoring orchestrator trigger (protected) ────────────────────
router.post('/monitor', triggerMonitoringRun);
router.post('/check-now', checkNow);

// ─── 3. Static user dashboard & user-specific endpoints ─────────────────
router.get('/dashboard-summary', getDashboardSummary);
router.get('/open', getOpenRecruitments);          // powers "Open Now" click-through
router.get('/my-events', getUserEvents);
router.get('/applications', getUserApplications);
router.get('/relevant', getRelevantRecruitments);
router.get('/matches', getUserMatches);

// ─── 4. Parametric recruitment endpoints ──────────────────────────────
router.get('/:recruitmentId', getRecruitmentDetail);
router.post('/:recruitmentId/evaluate', evaluateMatch);
router.post('/:recruitmentId/application', saveApplicationDecision);

// ─── 5. Dev/test collection trigger endpoints ──────────────────────────
router.post('/collect/ssc', triggerSSCCollection);
router.post('/collect/appsc', triggerAPPSCCollection);
router.post('/collect/rrb', triggerRRBCollection);

export default router;
