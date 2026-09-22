import express from 'express';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import transporter from '../mailer.js';
import jwt from 'jsonwebtoken';
import  verifyToken  from '../middleware/verifyToken.js';
import {body,validationResult} from 'express-validator';
const router = express.Router();
///OTP generator function
 function generateOTP(){
   const otp = Math.floor(100000 + Math.random() * 900000).toString();
   return otp;
}
//writing signup api endpoint
router.post('/signup', 
 body('name').trim().notEmpty().withMessage('name is required'),
  async (req, res,next) => {
  const errors=validationResult(req);
    if(!errors.isEmpty())return res.status(400).json({ errors: errors.array() });
  try{
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
   const otp= generateOTP();
   const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
   console.log('sending mail from EMAIL_USER:', process.env.EMAIL_USER);
   const result= await pool.query(
        'insert into users (name,email,password_hash,otp_code,otp_expires_at) values ($1,$2,$3,$4,$5)',
        [name,email,hashedPassword,otp,otpExpiresAt]
     );
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your account',
    text: `Subject: Your verification code

           Hi,

          Your one-time verification code is: ${otp}

          This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email — no action is needed.

          Never share this code with anyone, including someone claiming to be from our team.`,
  });

     res.status(201).json({message:"successfully signed up"});
  }
  catch(err){
       console.log(err);
       if(err.code==="23505")return res.status(409).json({error:"email already registered"});
       next(err);
  }
});
// ---------------------------------------------------
//verify-OTP endpoint
router.post('/verify-otp', async (req, res,next) => {
  try {
    const { email, otp } = req.body;

    // 1. Fetch the user by email
    const result = await pool.query(
      'select id, otp_code, otp_expires_at, is_verified from users where email = $1',
      [email]
    );
     if(result.rows.length==0){
      console.log("no user found");
      return res.status(404).json({error:"no user found"});
     }
     else if(result.rows[0].is_verified==true){
       console.log("user is already verified and requested for resend otp");
       return res.json({message :"all ready verified"});
     }
     else if(result.rows[0].otp_code!==otp||result.rows[0].otp_expires_at<new Date()){
      console.log("wrong otp entered");
      return res.status(400).json({error:"wrong OTP entered! try again"})
     }
     await pool.query(
      'update users set is_verified = $1, otp_code = $2, otp_expires_at = $3 where email = $4',
       [true, null, null, email]
      );
    console.log("otp verified");
    res.status(201).json({message:"otp is verified"});
  } catch (err) {
    console.log(err);
    next(err);
  }
});
//--------------------------------------------------------------------------------
//otp resend
router.post('/resend-otp', async(req,res,next)=>{
  try{
    const {email} = req.body;
    const result = await pool.query(
      'select id, is_verified from users where email = $1',
      [email]
    );
    if(result.rows.length==0){
      console.log("no user found");
      return res.status(404).json({error:"no user found"});
     }
     else if(result.rows[0].is_verified==true){
       console.log("user is already verified and requested for resend otp");
       return res.status(200).json({message:"all ready verified"});
     }

    const otp= generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'update users set otp_code = $1, otp_expires_at = $2 where email = $3',
       [otp, otpExpiresAt, email]
      );
    console.log('sending mail from EMAIL_USER:', process.env.EMAIL_USER);
    await transporter.sendMail({
     from: process.env.EMAIL_USER,
     to: email,
     subject: 'Verify your account',
     text: `Subject: Your verification code

           Hi,

          Your one-time verification code is: ${otp}

          This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email — no action is needed.

          Never share this code with anyone, including someone claiming to be from our team.`,
    });
    res.status(201).json({message:"otp is resent"});
    
}
catch(err){
  console.log(err);
  next(err);
}
});
//----------------------------------------------------------------
//loginpage endpoint
router.post('/login',async(req,res,next)=>{
   try{
     const{email,password}=req.body;
     const result = await pool.query(
      'select id,is_verified,password_hash,role from users where email = $1',
      [email]
     );
     if(result.rows.length===0){
      console.log("invalid email");
      return res.status(401).json({error:"invalid emaild or password"});
     }
     console.log("checking verification...");
      if(result.rows[0].is_verified===false){
     // console.log("not verifed please verify your email first");
      return res.status(401).json({error:"not verified"});
     }
    // console.log("checking password...");
     const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
     if(isMatch===false){
         console.log("invalid  password");
      return res.status(401).json({error:"invalid emaild or password"});
     }
    //jwt token
     const token = jwt.sign(
        { userId: result.rows[0].id, role:result.rows[0].role},   
        process.env.JWT_SECRET,                  
        { expiresIn: '1h' }                      
      );
       console.log("logged in successfully..");
      res.status(200).json({
       message: "successfully logged in",
       token: token
      });
     
   }catch(err){
      console.log(err);
      next(err);
   }
});
//------------------------------------------------------------------------
//firstadmin call endpoint
router.post('/firstadmin',verifyToken,async(req,res,next)=>{
try{
    const id=req.user.userId;
    const info = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    console.log(info.rows[0].count); 
    const adminCount = parseInt(info.rows[0].count, 10);
    if(adminCount>0){
      console.log("you are not the first admin");
     return res.status(401).json({error:"admin present already"});
   }
   await pool.query(
    'update users set role = $1 where id = $2',
     ['admin', id]
   );
   console.log("fist admin made")
   res.status(201).json({
    "message": "admin made succesfully",
   })
  }
  catch(err){
    console.log(err);
    next(err);
  }
});
//----------------------------------------------------------
//change role endpoint
router.post('/change-role',verifyToken,async (req,res,next)=>{
  try{
      console.log(`requested user is ${req.user.userId}`);
      const {email,newRole}=req.body;
      if (newRole !== 'admin' && newRole !== 'student') {
      return res.status(400).json({error:"invalid role specified"});
      }
      console.log("proper role prompt...");
      const info = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
      const adminCount = parseInt(info.rows[0].count, 10);
      if(req.user.role==='student'){
       return res.status(403).json({error:"not authorized to change the role"})
     }
      const result = await pool.query(
      'select id,is_verified,password_hash,role from users where email = $1',
      [email]
     );
      if(result.rows.length===0){
      console.log("invalid email");
      return res.status(401).json({error:"invalid emaild or password"});
     }
     console.log("checking verification...");
      if(result.rows[0].is_verified===false){
     // console.log("not verifed please verify your email first");
      return res.status(401).json({error:"not verified"});
     }
     if(result.rows[0].role===newRole){
      console.log("same role alredy...");
      return res.status(201).json({message:"updated"});
     }
      if (adminCount === 1 && newRole === 'student' && result.rows[0].role === 'admin') {
      return res.status(403).json({error:"you are the last admin"});
    }
   if (newRole === 'admin') {
     await pool.query(
    'update users set role = $1, promoted_by = $2, promoted_at = $3 where email = $4',
    ['admin', req.user.userId, new Date(), email]
     );
    } else {
        await pool.query(
      'update users set role = $1 where email = $2',
      ['student', email]
     );
}
     res.status(201).json({message:"role updated"});
     
  }
  catch(err){
        console.log(err);
        next(err);
    }
});

export default router;
