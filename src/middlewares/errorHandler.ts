import { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error.code === 11000) {
    res.status(409).json({ message: 'Email already exists' });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: error.message });
    return;
  }

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Invalid JSON body' });
    return;
  }

  if (error.type === 'entity.too.large') {
    res.status(413).json({ message: 'Request body is too large' });
    return;
  }

  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
};
