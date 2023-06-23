const express = require("express");
const app = express();
app.use(express.json());
const cors = require("cors");
const https = require("https");
const mongoose = require("mongoose");
const fs = require("fs");
const cookieParser = require('cookie-parser')

const authRoute = require('./routes/auth')
const employeesRoute = require('./routes/employees')

const skillRoute = require('./routes/skill')


app.use(express.urlencoded({ extended: false })); //Parse URL-encoded bodies
app.use(cookieParser())

const corsOptions = {
  origin: "https://localhost:4200",
  credentials: true, // for cookies
};

// configure the middleware for parsing HTML requeest body

app.use(express.json());
app.use(express.urlencoded({ extended: false })); //Parse URL-encoded bodies
app.use(cors(corsOptions));
app.use('/api/Authenticate',authRoute)
app.use('/api/Employees',employeesRoute)
app.use('/api/skills',skillRoute)
try {
  mongoose.connect("mongodb://127.0.0.1:27017/listingsDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection;
  db.on("error", console.error.bind(console, "connection error:"));
  db.once("open", () => {
    console.log("DB connected");
  });
} catch (err) {
  console.log(err);
}

const serverOptions = {
  key: fs.readFileSync("ssl/local.key"),
  cert: fs.readFileSync("ssl/local.cert"),
};

https
  .createServer(serverOptions, app)
  .listen(8080, () => console.log(`listening on 8080`));
