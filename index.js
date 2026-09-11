
require('dotenv').config();
const http = require('http');

const server = http.createServer((req, res) => {
 if (req.url === '/') {
     res.writeHead(200, { 'Content-Type': 'text/plain' });
     res.end('Home page');
     console.log('Home page endpoint hit');
 } else if (req.url === '/health') {
     res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Health check OK');
    console.log('Health check endpoint hit');
  } else {
     res.writeHead(404, { 'Content-Type': 'text/plain' });
     res.end('unknown endpoint');
    console.log('Unknown endpoint hit');
  }
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});