import { Router } from 'express';
import { createSession, getAvailableSessions, bookSession, completeSession } from '../controllers/sessionController';
export const sessionRoutes = Router();
sessionRoutes.post('/', createSession);
sessionRoutes.get('/available', getAvailableSessions);
sessionRoutes.post('/:id/book', bookSession);
sessionRoutes.patch('/:id/complete', completeSession);
