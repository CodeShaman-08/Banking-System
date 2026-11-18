const mongoose =require("mongoose");


function connectToDB(){
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log("Database connected successfully");
        })
        .catch(err=>{
            console.log("error connecting db",err.message)
            process.exit(1)
        })
}

module.exports=connectToDB