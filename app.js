const express = require('express');
const app = express();
app.use(express.json());
require('dotenv').config();
const port = process.env.PORT || 3000;

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
app.listen(port, () => {
  console.log(`Serverrr is running on port ${port}`);
});