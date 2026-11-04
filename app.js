import express from 'express';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import bookingsRouter from './routes/booking.js';
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use((req, res, next) => {
  console.log(req.method);
  next();
});
app.use('/',authRouter);
app.use('/rooms',roomsRouter);
app.use('/booking',bookingsRouter);
app.use((err, req, res, next) => {
  console.log(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? "something went wrong" : "invalid request" });
});
app.listen(port, () => {
  console.log(`Serverrr is running on port ${port}`);
});
