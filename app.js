const express = require('express');
const app = express();
app.use(express.json());
require('dotenv').config();
const port = process.env.PORT || 3000;
const pool = require('./db');
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});
app.post('/echo', (req, res) => {
  res.send(req.body);
});
app.get('/', (req, res) => {
  res.send('home page');
});
app.get('/health', (req, res) => {  
  res.send('Health check');
});
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Something went wrong');
  }
});
app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).send(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Something went wrong');
  }
});
app.listen(port, () => {
  console.log(`Serverrr is running on port ${port}`);
});