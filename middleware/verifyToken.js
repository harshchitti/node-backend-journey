import express from 'express';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
function verifyToken(req, res, next) {
    console.log("verifying the token token");
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).send("no token provided");
  }

  const token = authHeader.split(' ')[1]; 

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next(); 
  } catch (err) {
    return res.status(401).send("invalid or expired token");
  }
}
export default verifyToken;