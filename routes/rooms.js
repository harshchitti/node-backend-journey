import express from 'express';
import 'dotenv/config';
import pool from '../db.js';
import  verifyToken  from '../middleware/verifyToken.js';
import requireAdmin from '../middleware/requireAdmin.js';
const router = express.Router();
router.post('/',verifyToken,requireAdmin,async (req,res)=>{
    try{
    const{name} = req.body;
    if(name === undefined || name.trim() === ""){
        return res.status(400).send("not a valid input");
    }
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

});
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

export default router;