import { Request, Response } from 'express';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { AppError } from '../utils/AppError';
import { objectId, requiredString } from '../utils/validation';

export async function createUser(req: Request, res: Response) {
  const fullName = requiredString(req.body?.fullName, 'fullName');
  const email = requiredString(req.body?.email, 'email').toLowerCase();
  const phone = requiredString(req.body?.phone, 'phone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'email must be valid');
  }
  const user = await User.create({ fullName, email, phone });

  res.status(201).json(user);
}

export async function getUserSessions(req: Request, res: Response) {
  const userId = objectId(req.params.id, 'id');

  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw new AppError(404, 'User not found');
  }

  const [result] = await Session.aggregate([
    { $match: { userId } },
    { $facet: {
      upcomingSessions: [
        { $match: { status: 'BOOKED', startTime: { $gte: new Date() } } },
        { $sort: { startTime: 1, _id: 1 } },
      ],
      completedSessions: [
        { $match: { status: 'COMPLETED' } },
        { $sort: { completedAt: -1, _id: 1 } },
      ],
    } },
  ]);

  res.json(result);
}
