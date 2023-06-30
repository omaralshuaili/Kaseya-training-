const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const crypto = require("crypto");

const { sendResponse } = require("../helpers/responseHandler");
const { validateUser } = require("../helpers/validations");
const { Users } = require("../models/userModel");
const { RefreshTokens } = require("../models/refreshTokenModel");
const { v4: uuidv4 } = require("uuid");

router.post("/login", async (req, res) => {
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
      return sendResponse(
        res,
        400,
        "Too many attempts. Please try again later!"
      );
    }

    if (!validPass) {
      await increaseAttempts(user);
      return sendResponse(res, 400, "Invalid email or password.");
    }

    // Generate a new access token
    const accessToken = await createAccessToken(user);

    // Generate a new refresh token and store it in the database
    const refreshToken = await createRefreshToken(user);

    // Set the refresh token in the response cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Send the response with the access token
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
});

router.post("/register", async (req, res) => {
  try {
    // Validation before adding users
    const { error } = validateUser(req.body);
    if (error) return sendResponse(res, 400, error.details[0].message);

    // Check if email already exists
    const userNameExists = await Users.findOne({ Username: req.body.Username });
    console.log(userNameExists);
    if (userNameExists) return sendResponse(res, 400, "Email already exists.");

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.Password, salt);

    // Create new user
    const user = new Users({
      Username: req.body.Username,
      Password: hashedPassword,
    });

    // Save the user to the database
    await user.save();
    sendResponse(res, 201, "Thanks for registering with us.");
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, err);
  }
});

router.post("/logout", async (req, res) => {
  try {
    res.clearCookie("refreshToken");
    sendResponse(res, 200, "Logged out successfully.");
  } catch (err) {
    console.log(err);
    sendResponse(err, 500, "Internal Server Error.");
  }
});

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
    expiresIn: "1h",
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

  // Generate a unique identifier (jwtid) for the token
  const jwtid = await generateJti();

  // Save the refresh token to the database
  const refreshToken = jwt.sign(payload, secret, { ...options, jwtid: jwtid });
  console.log("this is the 1st one :" + jwtid);
  // Update the refreshToken array of the user
  await RefreshTokens.findOneAndUpdate(
    { jwtid: jwtid },
    { $push: { refreshToken } },
    { upsert: true }
  );

  return refreshToken;
}

async function createRefreshTokenWithJwtid(token) {
  const secret = process.env.REFRESH_TOKEN_SECRET;

  // Generate a random component for the refresh token
  const randomComponent = await crypto.randomBytes(16).toString("hex");

  // Include the random component in the refresh token payload
  const refreshTokenPayload = {
    ...token,
    random: randomComponent,
  };

  // Save the refresh token to the database
  const refreshToken = jwt.sign(refreshTokenPayload, secret);

  // Update the refreshToken array of the user
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

router.post("/refresh-token", async (req, res) => {
  // Get the refresh token from the request cookies
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return sendResponse(res, 401, "Refresh token not found.");
  }

  try {
    // Verify and decode the refresh token
    const decodedToken = await jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      {
        ignoreExpiration: true, // Allow expired tokens for revocation check
      }
    );

    // Check if the refresh token is revoked
    const tokenRevoked = await isRefreshTokenRevoked(decodedToken.jwtid);

    if (tokenRevoked) {
      return sendResponse(res, 401, "Refresh token has been revoked.");
    }

    // Generate a new access token
    const accessToken = await createAccessToken(decodedToken);

    const mostRecentToken = await findMostRecentRefreshTokenByJWTID(
      decodedToken.jti
    );


    console.log(mostRecentToken === refreshToken);
    if (mostRecentToken != refreshToken) {
      await revokeTokenFamily(decodedToken.jti);
      return sendResponse(res, 401, "Refresh token has been compromised.");
    }

    // Generate a new refresh token and update the corresponding entry in the database
    const newRefreshToken = await createRefreshTokenWithJwtid(decodedToken);

    await updateRefreshToken(decodedToken.jti, newRefreshToken);

    // Set the new refresh token in the response cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Send the response with the new access token
    sendResponse(res, 200, "Token refreshed successfully.", {
      accessToken,
    });
  } catch (err) {
    console.error(err);
    sendResponse(res, 401, "Invalid refresh token.");
  }
});

async function isRefreshTokenRevoked(jwtid) {
  // Check if the refresh token (identified by jti) exists in the database
  const refreshToken = await RefreshTokens.findOne({ jti: jwtid });
  console.log("is revoked " + refreshToken);
  if (refreshToken) {
    console.log("is revoked " + refreshToken.revoked);
    return refreshToken.revoked;
  }
  return false;
}

async function updateRefreshToken(jwtid, newRefreshToken) {
  try {
    // Find the refresh token by its jwtid and push the new refresh token to the refreshToken array
    await RefreshTokens.findOneAndUpdate(
      { jwtid },
      { $push: { refreshToken: newRefreshToken } }
    );
  } catch (err) {
    // Handle any errors that occur during the database update
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
      console.log(
        "this should be the last refresh token : " + lastRefreshToken
      );
      return lastRefreshToken;
    }
  } catch (err) {
    // Handle the error
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
    // Handle any errors that occur during the update
    console.error(err);
  }
}

module.exports = router;
