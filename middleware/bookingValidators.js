import { body, validationResult } from 'express-validator';
const MIN_MS = 10 * 60 * 1000;
const MAX_MS = 2 * 60 * 60 * 1000;
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const IST_OFFSET_MIN = 330;
const OPEN_MIN = 8 * 60;
const CLOSE_MIN = 18 * 60;
function minutesIST(date) {
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MIN) % (24 * 60);
}

export function validateBookingRules(start, end, now) {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) return 'end_time must be after start_time';
  if (duration < MIN_MS) return 'booking must be at least 10 minutes';
  if (duration > MAX_MS) return 'booking can be at most 2 hours';
  if (start.getTime() <= now.getTime()) return 'start_time must be in the future';
  if (start.getTime() > now.getTime() + HORIZON_MS) return 'bookings can only be made up to 7 days ahead';
  const startMin = minutesIST(start);
  const endMin = minutesIST(end);
  if (startMin < OPEN_MIN || startMin >= CLOSE_MIN || endMin <= OPEN_MIN || endMin > CLOSE_MIN) {
    return 'bookings are only allowed between 8:00 and 18:00 IST';
  }
  return null;
}

const bookingValidators = [
  body('room_id').isInt({ min: 1 }).withMessage('room_id must be a positive integer'),
  body('start_time').isISO8601().matches(/(Z|[+-]\d{2}:\d{2})$/).withMessage('start_time must be ISO format ending in Z or an offset'),
  body('end_time').isISO8601().matches(/(Z|[+-]\d{2}:\d{2})$/).withMessage('end_time must be ISO format ending in Z or an offset'),
   (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const start = new Date(req.body.start_time);
    const end = new Date(req.body.end_time);
    const error = validateBookingRules(start, end, new Date());
    if (error) return res.status(400).json({ error });
    next();
  },
];

export default bookingValidators;