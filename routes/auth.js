const express = require('express')
const router = express.Router();
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
require('dotenv').config();


const { sendResponse } = require('../helpers/responseHandler')
const { validateUser } = require('../helpers/validations')
const {Users}  = require('../models/userModel');


router.post('/login', async (req, res) => {

    try {
        const { error } = validateUser(req.body);
        if (error) {
            return sendResponse(res, 400, error.details[0].message);
        }

        const user = await Users.findOne({ userName: req.body.userName });
        if (!user) {
            return sendResponse(res, 400, 'Invalid email or password.');
        }

        const validPass = await bcrypt.compare(req.body.Password, user.Password);
        if (!validPass) {
            return sendResponse(res, 400, 'Invalid email or password.');
        }

      

        const token = createJWT(user);
        await setRefreshCookie(user, res);

        sendResponse(res, 200, 'Login successful', {
            accessToken: token,
            user: {
                Username: user.Username
            }
        });

    } catch (err) {
        console.error(err);
        sendResponse(res, 500, 'Server Error');
    }
});


router.post('/register', async (req, res) => {
    try {
        // validation before adding users
        const { error } = validateUser(req.body);
        if (error) return sendResponse(res, 401, error.details[0].message);

        // check if email already exists
        const UserNameExist = await Users.findOne({ Username: req.body.Username });
        if (UserNameExist) return sendResponse(res, 401, 'Email already exists.');

        // hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.Password, salt);

        // create new user
        const user = new Users({
            Username: req.body.Username,
            Password: hashedPassword,
        });

        // save the user to the database
        await user.save();
        sendResponse(res, 201, 'Thanks for registering with us.');

    } catch (err) {
        console.error(err);
        sendResponse(res, 500, 'Server Error');
    }
});





function createJWT(user) {
  const payload = {
    _id: user._id,
    userName: user.userName,
  };

  const options = {
    expiresIn: '1h',  
  };

  const secret = process.env.JWT_SECRET_KEY;

  return jwt.sign(payload, secret, options);
}



function createRefreshToken(user) {
  const payload = {
    _id: user._id,
    userName: user.userName,
  };

  const options = {
    expiresIn: '7d',  
  };

  const secret = process.env.REFRESH_TOKEN_SECRET; 

  return jwt.sign(payload, secret, options);
}

function setRefreshCookie(user, res) {
  const refreshToken = createRefreshToken(user);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // set to true in production
    sameSite: 'strict'  
  });
}




module.exports  = router