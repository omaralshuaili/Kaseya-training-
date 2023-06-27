const express = require("express");
const { expect } = require("chai");
const supertest = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = express();
app.use(express.json());
require("dotenv").config();
const jwt = require("jsonwebtoken");

const { Users } = require("../models/userModel");
const authRoute = require("../routes/auth");
app.use("/api/Authenticate", authRoute);

const request = supertest(app);
process.env.JWT_SECRET_KEY = 'testKey';
process.env.REFRESH_TOKEN_SECRET = 'testKey';

describe("Router", async () => {
  before(async function  () {
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/testDB", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("Test database connected");
    } catch (err) {
      console.error("Error connecting to test database:", err);
    }

    mongoose.connection.collection("users").deleteMany({}, () => {
      done();
    });

    // Create a mock user
    const mockUser = new Users({
      Username: "test@example.com",
      Password: await bcrypt.hash("testPassword", 10), // Hash the password
    });

    // Save the mock user to the database
    await mockUser.save();

  });

  describe("POST /login",  () => {
    it("should return a 400 error if required fields are missing", (done) => {
      request
        .post("/api/Authenticate/login")
        .send({})
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.equal("Please fill in all the fields.");
          done();
        });
    });

    it("should return a 400 error if invalid email or password is provided", (done) => {
      request
        .post("/api/Authenticate/login")
        .send({ Username: "invalidemail", Password: "invalid" })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.equal("Invalid email or password.");
          done();
        });
    });

    it("should return a 200 status code on successful login", (done) => {
      request
        .post("/api/Authenticate/login")
        .send({ Username: "test@example.com", Password: "testPassword" })
        .expect(200)
        .end((err, res) => {
          console.log(res.text);
          if (err) return done(err);
          expect(res.body.message).to.equal("Login successful");
          done();
        });
    });

    it("should return a 400 error if incorrect password is provided", (done) => {
      request
        .post("/api/Authenticate/login")
        .send({ Username: "test@example.com", Password: "incorrectPassword" })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.equal("Invalid email or password.");
          done();
        });
    });
  });

  describe("POST /register", () => {
    it("should return a 201 status code on successful registration", (done) => {
      request
        .post("/api/Authenticate/register")
        .send({ Username: "test2@example.com", Password: "testPassword" })
        .expect(201)
        .end((err, res) => {
           
          if (err) return done(err);
          expect(res.body.message).to.equal("Thanks for registering with us.");
          done();
        });
    });

    it("should return a 400 error if email already exists", (done) => {
      request
        .post("/api/Authenticate/register")
        .send({ Username: "test@example.com", Password: "testPassword" })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.equal("Email already exists.");
          done();
        });
    });
  });
  describe("POST /refresh-token", () => {
    it("should return a 401 error if refresh token is not found in the request cookies", (done) => {
      request
        .post("/api/Authenticate/refresh-token")
        .expect(401)
        .end((err, res) => {
          if (err) {
            console.log(err)
            return done(err);
          }
          expect(res.body.message).to.equal("Refresh token not found.");
          done();
        });
    });
  
    it("should return a 401 error if refresh token has been revoked", (done) => {
      // Generate a revoked refresh token
      const revokedToken = jwt.sign(
        {
          jwtid: "revokedTokenId",
          userName: "test@example.com",
        },
        process.env.REFRESH_TOKEN_SECRET
      );
  
      request
        .post("/api/Authenticate/refresh-token")
        .set("Cookie", `refreshToken=${revokedToken}`)
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.message).to.equal("Refresh token has been revoked.");
          done();
        });
    });
  
    it("should return a 401 error if refresh token has been compromised", (done) => {
      // Generate an old refresh token
      const oldToken = jwt.sign(
        {
          jwtid: "oldTokenId",
          userName: "test@example.com",
        },
        process.env.REFRESH_TOKEN_SECRET
      );
  
      request
        .post("/api/Authenticate/refresh-token")
        .set("Cookie", `refreshToken=${oldToken}`)
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.message).to.equal("Refresh token has been compromised.");
          done();
        });
    });
  
    it("should return a 200 status code and a new access token on successful token refresh", (done) => {
      // Generate a valid refresh token
      const refreshToken = jwt.sign(
        {
          jwtid: "validTokenId",
          Username: "test@example.com",
        },
        process.env.REFRESH_TOKEN_SECRET
      );
  
      request
        .post("/api/Authenticate/refresh-token")
        .set("Cookie", `refreshToken=${refreshToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.message).to.equal("Token refreshed successfully.");
          expect(res.body.accessToken).to.exist;
          done();
        });
    });
  
    it("should return a 401 error if refresh token is invalid", (done) => {
      // Generate an invalid refresh token
      const invalidToken = "invalidRefreshToken";
  
      request
        .post("/api/Authenticate/refresh-token")
        .set("Cookie", `refreshToken=${invalidToken}`)
        .expect(401)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          expect(res.body.message).to.equal("Invalid refresh token.");
          done();
        });
    });
  });
  
  

  after(async () => {
    await mongoose.connection.close();
    console.log("Test database connection closed");
  });
});
