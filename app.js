import express from 'express';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from './db.js';
import transporter from './mailer.js';
import jwt from 'jsonwebtoken';
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
///OTP generator function
 function generateOTP(){
   const otp = Math.floor(100000 + Math.random() * 900000).toString();
   return otp;
}
//jwt verification
function verifyToken(req, res, next) {
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
//---------
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
// --------------------------------------------------------------------
//writing signup api endpoint
app.post('/signup', async (req, res) => {
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
    text: `Your OTP for room booking is ${otp}. It expires in 10 minutes.`,
  });

     res.status(201).send("successfully signed up");
  }
  catch(err){
       console.log(err);
       if(err.code==="23505")return res.status(409).send("email already registered");
       res.status(500).send("something went wrong");
  }
});
// ---------------------------------------------------
//verify-OTP endpoint
app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Fetch the user by email
    const result = await pool.query(
      'select id, otp_code, otp_expires_at, is_verified from users where email = $1',
      [email]
    );
     if(result.rows.length==0){
      console.log("no user found");
      return res.status(404).send("no user found");
     }
     else if(result.rows[0].is_verified==true){
       console.log("user is already verified and requested for resend otp");
       return res.send("all ready verified");
     }
     else if(result.rows[0].otp_code!==otp||result.rows[0].otp_expires_at<new Date()){
      console.log("wrong otp entered");
      return res.status(400).send("wrong OTP entered! try again")
     }
     await pool.query(
      'update users set is_verified = $1, otp_code = $2, otp_expires_at = $3 where email = $4',
       [true, null, null, email]
      );
    console.log("otp verified");
    res.status(201).send("otp is verified");
  } catch (err) {
    console.log(err);
    res.status(500).send("something went wrong");
  }
});
//--------------------------------------------------------------------------------
//otp resend
app.post('/resend-otp', async(req,res)=>{
  try{
    const {email} = req.body;
    const result = await pool.query(
      'select id, is_verified from users where email = $1',
      [email]
    );
    if(result.rows.length==0){
      console.log("no user found");
      return res.status(404).send("no user found");
     }
     else if(result.rows[0].is_verified==true){
       console.log("user is already verified and requested for resend otp");
       return res.send("all ready verified");
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
     text: `Your OTP for room booking is ${otp}. It expires in 10 minutes.`,
    });
    res.status(201).send("otp is resent");
    
}
catch(err){
  console.log(err);
  res.status(500).send("something went wrong");
}
});
//----------------------------------------------------------------
//loginpage endpoint
app.post('/login',async(req,res)=>{
   try{
     const{email,password_entered}=req.body;
     const result = await pool.query(
      'select id,is_verified,password_hash,role from users where email = $1',
      [email]
     );
     if(result.rows.length===0){
      console.log("invalid email");
      return res.status(401).send("invalid emaild or password");
     }
     console.log("checking verification...");
      if(result.rows[0].is_verified===false){
     // console.log("not verifed please verify your email first");
      return res.status(401).send("not verified");
     }
    // console.log("checking password...");
     const isMatch = await bcrypt.compare(password_entered, result.rows[0].password_hash);
     if(isMatch===false){
         console.log("invalid  password");
      return res.status(401).send("invalid emaild or password");
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
      res.status(500).send("something went wrong");
   }
});
//------------------------------------------------------------------------
//firstadmin call endpoint
app.post('/firstadmin',verifyToken,async(req,res)=>{
try{
  const {email}=req.body;
  const result = await pool.query(
      'select id,is_verified,password_hash,role from users where email = $1',
      [email]
     );
      if(result.rows.length===0){
      console.log("invalid email");
      return res.status(401).send("invalid emaild or password");
     }
     console.log("checking verification...");
      if(result.rows[0].is_verified===false){
     // console.log("not verifed please verify your email first");
      return res.status(401).send("not verified");
     }
    const info = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    console.log(info.rows[0].count); 
    const adminCount = parseInt(info.rows[0].count, 10);
    if(adminCount>0){
      console.log("you are not the first admin");
     return res.status(401).send("admin present already");
   }
   await pool.query(
    'update users set role = $1 where email = $2',
     ['admin', email]
   );
   console.log("fist admin made")
   res.status(201).json({
    "message": "admin made succesfully",
   })
  }
  catch(err){
    console.log(err);
    res.status(500).send("something went wrong");
  }
});
//----------------------------------------------------------
app.post('/change-role',verifyToken,async (req,res)=>{
  try{
      const {email,newRole}=req.body;
      if (newRole !== 'admin' && newRole !== 'student') {
      return res.status(400).send("invalid role specified");
      }
      console.log("proper role prompt...");
      const info = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
      const adminCount = parseInt(info.rows[0].count, 10);
      if(req.user.role==='student'){
       return res.status(403).send("not authorized to change the role")
     }
      const result = await pool.query(
      'select id,is_verified,password_hash,role from users where email = $1',
      [email]
     );
      if(result.rows.length===0){
      console.log("invalid email");
      return res.status(401).send("invalid emaild or password");
     }
     console.log("checking verification...");
      if(result.rows[0].is_verified===false){
     // console.log("not verifed please verify your email first");
      return res.status(401).send("not verified");
     }
     if(result.rows[0].role===newRole){
      console.log("same role alredy...");
      return res.status(201).send("updated");
     }
      if (adminCount === 1 && newRole === 'student' && result.rows[0].role === 'admin') {
      return res.status(403).send("you are the last admin");
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
     res.status(201).send("role updated");
     
  }
  catch(err){
        console.log(err);
        res.status(500).send("something went wrong");
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
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body; 
    const result = await pool.query(
      'update users set name = $1, email=$2 where id = $3 returning *',
      [name ,email,id]
    );

  if (result.rows.length === 0) {
  return res.status(404).send('User not found');
    }
   res.send(result.rows[0]);     
  } catch (err) {
    console.error(err);
    res.status(500).send('Something went wrong');
  }
});
app.delete('/users/:id', async (req, res) => {
  try{
    const{id}=req.params;
    const result = await pool.query(
      'delete from users where id=$1 returning *',
      [id]
    );
    if(result.rows.length==0)return res.status(404).send('user not found');
    res.send(result.rows[0]);
  }
  catch(err){
    console.log(err);
    res.status(500).send('something went wrong');
  }
});
app.listen(port, () => {
  console.log(`Serverrr is running on port ${port}`);
});