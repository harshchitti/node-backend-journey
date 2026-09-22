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
    async(req,res)=>{
        const errors=validationResult(req);
        if(!errors.isEmpty())return res.status(400).json({ errors: errors.array() });
        try{
          const{name} = req.body;
          const result=await pool.query(
          'insert into rooms (name) values ($1) returning *',
          [name]
         );
         return res.status(201).json(result.rows[0]);
        }catch(err){
         console.log(err);
         if(err.code==="23505")return res.status(409).send("room number already exists");
         return res.status(500).send("something went wrong");
       } 
    }
);
router.get('/',verifyToken,async (req,res)=>{
      try{
           const result = await pool.query(
            'select * from rooms',
           );
           return res.status(200).json(result.rows);
      }catch(err){
           console.log(err);
          return res.status(500).send("something went wrong");
      }
});
router.patch('/:id',verifyToken,requireAdmin, async(req,res)=>{
    try{
      const {status}=req.body;
      if(status!=="active"&&status!=="inactive")return res.status(400).send("Not a valid input");
      const { id } = req.params;

    const result=await pool.query(
        'update rooms set status =$1 where id = $2 returning*',
        [status,id]
    );
    if(result.rows.length===0)return res.status(404).send("no room found");
    return res.status(200).json(result.rows[0]);
   }catch(err){
        console.log(err);
        return res.status(500).send("something went wrong");
   }
});

export default router;