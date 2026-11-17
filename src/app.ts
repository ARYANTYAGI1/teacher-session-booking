import express from 'express';
import { userRoutes } from './routes/userRoutes';
import { sessionRoutes } from './routes/sessionRoutes';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/users', userRoutes);
app.use('/sessions', sessionRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);
