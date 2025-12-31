import express from 'express';
import { verifyToken, authorizeRole } from '../middleware/auth.js';
import {
  createForm,
  getAllForms,
  getFormsByCategory,
  getFormById,
  updateForm,
  deleteForm,
  getCategories
} from '../controllers/formController.js';

const router = express.Router();

// Form routes - only admin can create, update, delete
router.post('/', verifyToken, authorizeRole('admin'), createForm);
router.put('/:formId', verifyToken, authorizeRole('admin'), updateForm);
router.delete('/:formId', verifyToken, authorizeRole('admin'), deleteForm);

// Public form routes - anyone authenticated can view
router.get('/', verifyToken, getAllForms);
router.get('/categories', verifyToken, getCategories);
router.get('/category/:category', verifyToken, getFormsByCategory);
router.get('/:formId', verifyToken, getFormById);

export default router;
