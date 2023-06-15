const express = require('express');
const router = express.Router();
const {Employees} = require('../models/employeesModel'); 

const {authenticateJWT} = require("../helpers/middleware")

// GET api/Employees
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const employees = await Employees.find({});
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
