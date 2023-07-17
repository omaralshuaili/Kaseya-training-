const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const { createTransport } = require('nodemailer');
const { sendResponse } = require("../helpers/responseHandler");
const { validateUser } = require("../helpers/validations");
const { Users } = require("../models/userModel");
const { RefreshTokens } = require("../models/refreshTokenModel");
const { v4: uuidv4 } = require("uuid");
const moment = require('moment');

require("dotenv").config();

router.post("/login", loginHandler);
router.post("/register", registerHandler);
router.post("/logout", logoutHandler);
router.post("/refresh-token", refreshTokenHandler);
router.post("/verify", verifyHandler)

async function loginHandler(req, res) {
  try {
    if (!req.body.Username || !req.body.Password || !req.body) {
      return sendResponse(res, 400, "Please fill in all the fields.");
    }

    const { error } = validateUser(req.body);
    if (error) {
      return sendResponse(res, 400, error.details[0].message);
    }

    const user = await Users.findOne({ Username: req.body.Username });

    

    if (!user) {
      return sendResponse(res, 400, "Invalid email or password.");
    }

    const validPass = await bcrypt.compare(req.body.Password, user.Password);

    if (user.attempts > 10) {
      await lockUser(user);
      return sendResponse(res, 400, "Too many attempts. Please try again later!");
    }

    if (!validPass) {
      await increaseAttempts(user);
      return sendResponse(res, 400, "Invalid email or password.");
    }

    if(!user.verify){
      return sendResponse(res,403, "Please verify your email!")
    }

    const accessToken = await createAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      domain: "backend-omar-alshuaili-kaseya-training.azurewebsites.net",
      secure: true,
      sameSite: "none",
    });

    sendResponse(res, 200, "Login successful", {
      accessToken: accessToken,
      user: {
        Username: user.Username,
      },
    });
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, err);
  }
}

async function registerHandler(req, res) {
  try {
    const { error } = validateUser(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    const userNameExists = await Users.findOne({ Username: req.body.Username });
    if (userNameExists) return sendResponse(res, 400, "Email already exists.");


    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.Password, salt);

    const user = new Users({
      Username: req.body.Username,
      Password: hashedPassword,
    });

    await user.save();
    await sendEmailVerification(req.body.Username);

    sendResponse(res, 201, "Thanks for registering with us.");
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, err);
  }
}

async function verifyHandler(req,res){
  try{
    const email = req.body.email
    const token = req.body.token
    console.log(token)
    console.log(email)

    let user = await Users.findOne({Username:email})
    console.log(user)
    if(token != user.emailToken || !user.emailToken || user.isVerified || !user) {
      return sendResponse(res,404,"Token is not valid !")
    }

    user.isVerified = true
    user.emailToken = ""
    await user.save()
    sendResponse(res,200,"Email verified. You can log in now")

  } catch (err) {
    console.log(err);
    sendResponse(res, 500, err);
  }

}

async function logoutHandler(req, res) {
  try {
    res.clearCookie("refreshToken");
    sendResponse(res, 200, "Logged out successfully.");
  } catch (err) {
    console.log(err);
    sendResponse(err, 500, "Internal Server Error.");
  }
}

async function refreshTokenHandler(req, res) {
  if (!req.cookies.refreshToken) {
    return sendResponse(res, 401, "Refresh token not found.");
  }
  let refreshToken = req.cookies.refreshToken;

  try {
    const decodedToken = await jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      {
        ignoreExpiration: true,
      }
    );

    const tokenRevoked = await isRefreshTokenRevoked(decodedToken.jwtid);

    if (tokenRevoked) {
      return sendResponse(res, 401, "Refresh token has been revoked.");
    }

    const accessToken = await createAccessToken(decodedToken);

    const mostRecentToken = await findMostRecentRefreshTokenByJWTID(
      decodedToken.jti
    );

    if (mostRecentToken != refreshToken) {
      await revokeTokenFamily(decodedToken.jti);
      return sendResponse(res, 401, refreshToken);
    }

    const newRefreshToken = await createRefreshTokenWithJwtid(decodedToken);

    await updateRefreshToken(decodedToken.jti, newRefreshToken);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      domain: "backend-omar-alshuaili-kaseya-training.azurewebsites.net",
      secure: true,
      sameSite: "none",
    });

    sendResponse(res, 200, "Token refreshed successfully.", {
      accessToken,
    });
  } catch (err) {
    console.error(err);
    sendResponse(res, 401, err);
  }
}

async function increaseAttempts(user) {
  await Users.findOneAndUpdate(user._id, {
      $inc: { attempts: 1 },
  });
}

async function lockUser(user) {
  await Users.findOneAndUpdate(user._id, {
    $set: { locked: true },
  });
}

function createAccessToken(user) {
  const payload = {
    _id: user._id,
    userName: user.Username,
  };

  const options = {
    expiresIn: "10s",
  };

  const secret = process.env.JWT_SECRET_KEY;

  return jwt.sign(payload, secret, options);
}

async function createRefreshToken(user) {
  const payload = {
    _id: user._id,
    userName: user.Username,
  };

  const options = {
    expiresIn: "7d",
  };

  const secret = process.env.REFRESH_TOKEN_SECRET;
  const jwtid = await generateJti();

  const refreshToken = jwt.sign(payload, secret, { ...options, jwtid: jwtid });
  await RefreshTokens.findOneAndUpdate(
    { jwtid: jwtid },
    { $push: { refreshToken } },
    { upsert: true }
  );

  return refreshToken;
}

async function sendEmailVerification(email) {
  const token = crypto.randomBytes(124).toString('hex');

  const transporter = createTransport({
    host: "smtp-relay.sendinblue.com",
    port: 587,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSEMAIL,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: `Thanks for joining us !`,
    html: `<!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>Simple Transactional Email</title>
          <style>
            /* CSS styles here */
          </style>
        </head>
        <body class="">
          <table border="0" cellpadding="0" cellspacing="0" class="body">
            <!-- Email content here -->
            <tr>
              <td> </td>
              <td class="container">
                <div class="content">
                  <span class="preheader">Subscribe to Coloured.com.ng mailing list</span>
                  <table class="main">
                    <!-- START MAIN CONTENT AREA -->
                    <tr>
                      <td class="wrapper">
                        <table border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td>
                              <h1>Confirm your email</h1>
                              <h2>You are just one step away</h2>
                              <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                                <tbody>
                                  <tr>
                                    <td align="left">
                                      <table border="0" cellpadding="0" cellspacing="0">
                                        <tbody>
                                          <tr>
                                            <td><a href="https://localhost:4200/?verify=${email}&token=${token}" target="_blank">Confirm Email</a></td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              <p>If you received this email by mistake, simply delete it. You won't be subscribed if you don't click the confirmation link above.</p>
                            </td>
                          </tr>
                        </table>93
                      </td>
                    </tr>
                    <!-- END MAIN CONTENT AREA -->
                  </table>
                </div>
              </td>
              <td> </td>
            </tr>
            <!-- End of email content -->
          </table>
        </body>
      </html>
      `
  };

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
  const user = await Users.findOneAndUpdate({ Username: email },{emailToken:token});
  await user.save()

  

}

async function createRefreshTokenWithJwtid(token) {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  const randomComponent = await crypto.randomBytes(16).toString("hex");
  const refreshTokenPayload = {
    ...token,
    random: randomComponent,
  };
  const refreshToken = jwt.sign(refreshTokenPayload, secret);
  await RefreshTokens.findOneAndUpdate(
    { jti: token.jti },
    { $push: { refreshToken } }
  );
  console.log(refreshToken);
  return refreshToken;
}

function generateJti() {
  return uuidv4();
}

async function isRefreshTokenRevoked(jwtid) {
  const refreshToken = await RefreshTokens.findOne({ jti: jwtid });
  if (refreshToken) {
    return refreshToken.revoked;
  }
  return false;
}

async function updateRefreshToken(jwtid, newRefreshToken) {
  try {
    await RefreshTokens.findOneAndUpdate(
      { jwtid },
      { $push: { refreshToken: newRefreshToken } }
    );
  } catch (err) {
    console.log(err);
  }
}

async function findMostRecentRefreshTokenByJWTID(jwtid) {
  try {
    const doc = await RefreshTokens.findOne(
      { jwtid: jwtid },
      { refreshToken: { $slice: -1 } }
    ).exec();
    if (doc && doc.refreshToken && doc.refreshToken.length > 0) {
      const lastRefreshToken = doc.refreshToken[0];
      console.log("this should be the last refresh token : " + lastRefreshToken);
      return lastRefreshToken;
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}

async function revokeTokenFamily(jwtid) {
  try {
    const doc = await RefreshTokens.findOne({ jwtid: jwtid });
    if (doc) {
      await RefreshTokens.updateOne({ jwtid: jwtid }, { revoked: true });
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = router;
