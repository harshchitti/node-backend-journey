import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import  verifyToken  from '../middleware/verifyToken.js';
import {body,validationResult} from 'express-validator';
const router = express.Router();
router.post('/',async (req,res,next)=>{
const client = await pool.connect();
try {
  const { room_id, user_id, start_time, end_time } = req.body;
  await client.query('BEGIN');
  const roomLock = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [room_id]);
  const overlap = await client.query(
    'SELECT * FROM bookings WHERE room_id = $1 AND NOT (end_time <= $2 OR start_time >= $3)',
    [room_id, start_time, end_time]
  );
  if (overlap.rows.length !== 0) {
    await client.query('ROLLBACK');
    return res.status(409).json({ error: 'room unavailable' });
  }
  const insertResult = await client.query(
    'INSERT INTO bookings (room_id,user_id,start_time,end_time,status,created_by_role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [room_id,user_id,start_time,end_time,"confirmed","student"]
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
export default router;
