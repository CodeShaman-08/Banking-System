const mongoose = require("mongoose");

function connectToDB() {
  return mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("Database connected successfully");
    })
    .catch((err) => {
      console.log("error connecting db", err.message);
      throw err;
    });
}

module.exports = connectToDB;
