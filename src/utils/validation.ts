import { Types, isObjectIdOrHexString } from 'mongoose';
import { AppError } from './AppError';

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, `${field} is required and must be a non-empty string`);
  }

  return value.trim();
}

export function objectId(value: unknown, field: string): Types.ObjectId {
  if (typeof value !== 'string' || !isObjectIdOrHexString(value)) {
    throw new AppError(400, `${field} must be a valid ObjectId`);
  }

  return new Types.ObjectId(value);
}

export function parseDate(value: unknown, field: string): Date {
  const text = requiredString(value, field);
  const date = new Date(text);
  const hasDateAndTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(text);

  if (!hasDateAndTime || Number.isNaN(date.getTime())) {
    throw new AppError(400, `${field} must be an ISO 8601 date with a timezone`);
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const hour = Number(text.slice(11, 13));
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);

  // JavaScript converts dates such as February 30 into a day in March.
  if (calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day || hour > 23) {
    throw new AppError(400, `${field} must be a valid calendar date`);
  }

  return date;
}

export function utcDayRange(value: unknown) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    throw new AppError(400, 'dateTimestamp must be a Unix timestamp in milliseconds');
  }

  const timestamp = Number(value);
  const start = new Date(timestamp);

  if (!Number.isSafeInteger(timestamp) || Number.isNaN(start.getTime())) {
    throw new AppError(400, 'Invalid dateTimestamp');
  }

  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  if (Number.isNaN(end.getTime())) {
    throw new AppError(400, 'dateTimestamp is out of range');
  }

  return { start, end };
}
