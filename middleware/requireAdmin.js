
function requireAdmin(req,res,next){
    console.log("admin check");
  try{  
    if(req.user.role==='admin'){
        next();
    }
     else return res.status(403).json({error:"not an admin"});
    }
    catch(err){
        console.log(err);
        return res.status(500).json({error: "something went wrong"});
    }
}
export default requireAdmin;

