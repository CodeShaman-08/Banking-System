const userModel = require("../models/user.model")
const jwt = require('jsonwebtoken')
const tokenBlackListModel = require("../models/blackList.model")

// Cross-site cookies (GitHub Pages UI -> hosted API) need SameSite=None + Secure.
const cookieOptions = process.env.NODE_ENV === "production"
    ? { httpOnly: true, sameSite: "none", secure: true }
    : { httpOnly: true, sameSite: "lax", secure: false }

async function userRegisterController(req,res) {
    const{email,password,name,username}=req.body

    const isExists = await userModel.findOne({
        email:email
    })
    if(isExists){
        return res.status(422).json({
            message:"user already exists",
            status:"failed"
    })
 }
  const user =  await userModel.create({
    email, password, name , username
  })

    const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET,{expiresIn:'1d'})
    res.cookie("token",token,cookieOptions)
    res.status(201).json({
        user:{
            _id:user._id,
            email:user.email,
            name: user.name
        },
        token
    })
}

async function userLoginController(req,res){
    const {email,password} = req.body
    const user = await userModel.findOne({email}).select("+password")
    if(!user){
        return res.status(401).json({
            message:"Invalid email or password",
            status:"failed"
        })
    }
    const isValidPassword = await user.comparePassword(password)    
    if(!isValidPassword){
        return res.status(401).json({
            message:"Invalid email or password",
            status:"failed"
        })
    }
    const token = jwt.sign({userId:user._id}, process.env.JWT_SECRET,{expiresIn:'1d'})
    res.cookie("token",token,cookieOptions)
    res.status(200).json({
        user:{
            _id:user._id,
            email:user.email,
            name: user.name
        },
        token
     })
}

async function userLogoutController(req,res){
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1]
  if(!token){
    return res.status(400).json({
      message:"user is logged out "
    })
  }

  res.clearCookie("token", cookieOptions)
  await tokenBlackListModel.create({
    token :token
  })
  res.status(200).json({
    message:"user logged out successfully"
  })
}
module.exports={userRegisterController,userLoginController,userLogoutController}






