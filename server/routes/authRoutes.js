import express from 'express';
import { register, login, createAdminUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/create-admin', createAdminUser);

export default router;
