const express = require('express');
const authController = require("../controllers/auth.controller")
const router=   express.Router();

const app=express()

router.post("/register",authController.userRegisterController)

router.post("/login",authController.userLoginController)

router.post("/logout",authController.userLogoutController)
module.exports=router