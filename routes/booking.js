import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import  verifyToken  from '../middleware/verifyToken.js';
import bookingValidators from '../middleware/bookingValidators.js';
import {body,param,validationResult} from 'express-validator';
const router = express.Router();
router.post('/',verifyToken,bookingValidators,
     
    async (req,res,next)=>{

const client = await pool.connect();
try {
  const { room_id,start_time,end_time } = req.body;
  const user_id = req.user.userId;
  await client.query('BEGIN');//locking for no user can book two different rooms at same time
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user_id]);
  const active = await client.query(
    "SELECT 1 FROM bookings WHERE user_id = $1 AND status = 'confirmed' AND end_time > NOW() LIMIT 1",
    [user_id]
  );
  if (active.rows.length !== 0) {
    await client.query('ROLLBACK');
    return res.status(409).json({ error: 'you already have an active booking' });
  }
  const roomLock = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [room_id]);
  const room = roomLock.rows[0];
  if (!room) {
    await client.query('ROLLBACK');
    return res.status(404).json({ error: 'room not found' });
  }
  if (room.status !== 'active') {
    await client.query('ROLLBACK');
    return res.status(409).json({ error: 'room is not active' });
  }
  const overlap = await client.query(
    'SELECT 1 FROM bookings WHERE room_id = $1 AND status = \'confirmed\' AND NOT (end_time <= $2 OR start_time >= $3) LIMIT 1',
    [room_id, start_time, end_time]
  );
  if (overlap.rows.length !== 0) {
    await client.query('ROLLBACK');
    return res.status(409).json({ error: 'room unavailable' });
  }
  const insertResult = await client.query(
    'INSERT INTO bookings (room_id,user_id,start_time,end_time,status,created_by_role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [room_id,user_id,start_time,end_time,"confirmed",req.user.role]
  );
  await client.query('COMMIT');
  return res.status(201).json({ message: insertResult.rows[0] });
} catch (err) {
  await client.query('ROLLBACK');
  console.log(err);
  next(err);
   
} finally {
  client.release();
}
});
//-----------------cancel booking------------------------------------------
router.patch('/:id/cancel', verifyToken,
  param('id').isInt({ min: 1 }).withMessage('booking id must be a positive integer'),
   async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [req.params.id]
      );
      const booking = result.rows[0];

      if (!booking || booking.user_id !== req.user.userId) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'booking not found' });
      }
       if (booking.status === 'cancelled') {
        await client.query('ROLLBACK');
        return res.status(200).json({ message: 'booking already cancelled' });
      }
      if (booking.end_time <= new Date()) {
       await client.query('ROLLBACK');
      return res.status(409).json({ error: 'booking has already ended' });
      }
      const updated = await client.query(
        "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
        [booking.id]
      );
      await client.query('COMMIT');
      return res.status(200).json({ message: 'booking cancelled', booking: updated.rows[0] });     
    } catch (err) {
      await client.query('ROLLBACK');
      console.log(err);
      next(err);
    } finally {
      client.release();
    }
  }
);
export default router;
