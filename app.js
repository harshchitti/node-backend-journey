import express from 'express';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use((req, res, next) => {
  console.log(req.method, req.body);
  next();
});
app.use('/',authRouter);
app.use('/rooms',roomsRouter);


app.listen(port, () => {
  console.log(`Serverrr is running on port ${port}`);
});