import express from 'express';
import 'dotenv/config';
import pool from '../db.js';
import  verifyToken  from '../middleware/verifyToken.js';
import requireAdmin from '../middleware/requireAdmin.js';
import {body,validationResult} from 'express-validator';
const router = express.Router();
router.post('/',
    verifyToken,
    requireAdmin,
    body('name').trim().notEmpty().withMessage('name is required'),
    async(req,res,next)=>{
        const errors=validationResult(req);
        if(!errors.isEmpty())return res.status(400).json({ errors: errors.array() });
        try{
          const{name} = req.body;
          const result=await pool.query(
          'insert into rooms (name) values ($1) returning *',
          [name]
         );
         return res.status(201).json({ message: "room created", room: result.rows[0] });
        }catch(err){
            console.log(err);
         if(err.code==="23505")return res.status(409).json({error:"room number already exists"});
         next(err);
       } 
    }
);
router.get('/',verifyToken,async (req,res,next)=>{
      try{
           const result = await pool.query(
            'select * from rooms',
           );
           return res.status(200).json(result.rows);
      }catch(err){
        console.log(err);
          next(err);
      }
});
router.patch('/:id',verifyToken,requireAdmin, 
    body('status').trim().notEmpty().isIn(['active','inactive']).withMessage('status must be active or inactive'),
    async(req,res,next)=>{
     const errors=validationResult(req);
     if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try{
      const {status}=req.body;
      const { id } = req.params; 
      const result=await pool.query(
        'update rooms set status =$1 where id = $2 returning*',
        [status,id]
      );
    if(result.rows.length===0)return res.status(404).json({"error":"no room found"});
    return res.status(200).json({ message: "room status updated", room: result.rows[0] });
     }catch(err){
        console.log(err);
        next(err);
     }
});

export default router;