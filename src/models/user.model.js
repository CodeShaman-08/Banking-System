const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")




const userSchema = mongoose.Schema({
    username:{
        type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true
    },
    email:{
        type:String,
        required:[true,"Email is required for creating user"],
        trim:true,
        lowercase:true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,"Please fill a valid email address"],
        unique:[true,"Email already exists"]
    },
    name:{
        type:String,
        required:[true,"Name is required for creating user"],
    },
    password:{
        type:String,
        required:[true,"Password is required for creating user"],
        minlength:[6,"Password must be at least 6 characters long"] ,
        select:false
    },
    systemUser:{
        type:Boolean,
        default:false,
        immutable:true,
        select:false
    }
},{
    timestamps:true 
})

userSchema.pre("save",async function(){
    if(!this.isModified("password")){
        return;
    }
    const hash = await bcrypt.hash(this.password,10)
    this.password = hash
    return;
})

userSchema.methods.comparePassword = async function(password){
 return await bcrypt.compare(password,this.password)
}

const userModel = mongoose.model("user",userSchema)
module.exports=userModel