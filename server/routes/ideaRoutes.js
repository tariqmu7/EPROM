import express from 'express';
import { verifyToken, authorizeRole } from '../middleware/auth.js';
import {
  submitIdea,
  getEmployeeIdeas,
  getIdeaById,
  getManagerIdeas,
  approveIdea,
  rejectIdea,
  getAllIdeas
} from '../controllers/ideaController.js';

const router = express.Router();

// Employee routes
router.post('/', verifyToken, authorizeRole('employee'), submitIdea);
router.get('/employee/my-ideas', verifyToken, authorizeRole('employee'), getEmployeeIdeas);

// Manager routes
router.get('/manager/pending', verifyToken, authorizeRole('manager'), getManagerIdeas);
router.post('/manager/approve', verifyToken, authorizeRole('manager'), approveIdea);
router.post('/manager/reject', verifyToken, authorizeRole('manager'), rejectIdea);

// Admin routes
router.get('/', verifyToken, authorizeRole('admin'), getAllIdeas);

// Shared routes
router.get('/:ideaId', verifyToken, getIdeaById);

export default router;
