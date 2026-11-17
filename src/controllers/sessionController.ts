import { Request, Response } from 'express';
import { Teacher } from '../models/Teacher';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { AppError } from '../utils/AppError';
import { objectId, parseDate, utcDayRange } from '../utils/validation';

export async function createSession(req: Request, res: Response) {
  const teacherId = objectId(req.body?.teacherId, 'teacherId');
  const startTime = parseDate(req.body?.startTime, 'startTime');
  const endTime = parseDate(req.body?.endTime, 'endTime');

  if (endTime <= startTime) {
    throw new AppError(400, 'endTime must be greater than startTime');
  }

  const teacherExists = await Teacher.exists({ _id: teacherId });
  if (!teacherExists) {
    throw new AppError(404, 'Teacher not found');
  }

  const session = await Session.create({ teacherId, startTime, endTime });

  res.status(201).json(session);
}

export async function getAvailableSessions(req: Request, res: Response) {
  const { start, end } = utcDayRange(req.query.dateTimestamp);
  const sessions = await Session.aggregate([
    { $match: { status: 'AVAILABLE', startTime: { $gte: start, $lt: end } } },
    { $sort: { startTime: 1, _id: 1 } },
  ]);

  res.json(sessions);
}

export async function bookSession(req: Request, res: Response) {
  const sessionId = objectId(req.params.id, 'id');
  const userId = objectId(req.body?.userId, 'userId');

  const userExists = await User.exists({ _id: userId });
  if (!userExists) {
    throw new AppError(404, 'User not found');
  }

  const session = await Session.findOneAndUpdate(
    { _id: sessionId, status: 'AVAILABLE' },
    { $set: { status: 'BOOKED', userId } },
    { new: true, runValidators: true },
  );

  if (!session) {
    const sessionExists = await Session.exists({ _id: sessionId });
    if (!sessionExists) {
      throw new AppError(404, 'Session not found');
    }

    throw new AppError(409, 'Only AVAILABLE sessions can be booked');
  }

  res.json(session);
}

export async function completeSession(req: Request, res: Response) {
  const sessionId = objectId(req.params.id, 'id');

  const session = await Session.findOneAndUpdate(
    { _id: sessionId, status: 'BOOKED' },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
    { new: true, runValidators: true },
  );

  if (!session) {
    const sessionExists = await Session.exists({ _id: sessionId });
    if (!sessionExists) {
      throw new AppError(404, 'Session not found');
    }

    throw new AppError(409, 'Only BOOKED sessions can be completed');
  }

  res.json(session);
}
