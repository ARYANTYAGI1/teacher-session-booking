import { Router } from 'express';
import { createUser, getUserSessions } from '../controllers/userController';
export const userRoutes = Router();
userRoutes.post('/', createUser);
userRoutes.get('/:id/sessions', getUserSessions);
