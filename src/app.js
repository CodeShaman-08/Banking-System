const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");


const authRouter = require("./routes/auth.routes");
const accountRouter = require("./routes/account.routes");
const transactionRoutes = require("./routes/transaction.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/transaction", transactionRoutes);
app.use(express.static(path.join(__dirname, "../public")));


module.exports = app;
