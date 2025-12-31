import express from 'express';
import { verifyToken, authorizeRole } from '../middleware/auth.js';
import {
  getAllSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
  getAllUsers,
  updateUserDepartment
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require admin authorization
router.use(verifyToken, authorizeRole('admin'));

// Signup request routes
router.get('/signup-requests', getAllSignupRequests);
router.post('/signup-requests/approve', approveSignupRequest);
router.post('/signup-requests/reject', rejectSignupRequest);

// Department routes
router.post('/departments', createDepartment);
router.get('/departments', getAllDepartments);
router.put('/departments/:departmentId', updateDepartment);
router.delete('/departments/:departmentId', deleteDepartment);

// User management routes
router.get('/users', getAllUsers);
router.put('/users/department', updateUserDepartment);

export default router;
