const express = require("express");
const router = express.Router();
const { SkillLevel } = require("../models/skillLevelModel");

const { authenticateJWT } = require("../helpers/middleware");
const { sendResponse } = require("../helpers/responseHandler");

// GET api/skill
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const skills = await SkillLevel.find({});
    sendResponse(res, 200, "", skills);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


module.exports = router