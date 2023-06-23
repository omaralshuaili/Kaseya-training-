const express = require('express');
const router = express.Router();
const {Employees} = require('../models/employeesModel'); 

const {authenticateJWT} = require("../helpers/middleware")
const {sendResponse} = require("../helpers/responseHandler")

// GET api/Employees
router.get("/", authenticateJWT, async (req, res) => {
  const refreshToken = req;

  try {
    const employees = await Employees.find({});
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


router.delete('/', authenticateJWT, async (req, res) => {
  try {
    const id = req.body.id;
    const employee = await Employees.findByIdAndDelete(id);
    
    if (!employee) {
      return sendResponse(res,404,"No employee found with this id",null)
    }

    sendResponse(res,200,"Employee deleted successfully",null)

  } catch (err) {
    console.error(err);
    sendResponse(res,500,"Internal Server Error",null)
  }
});

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const newEmployee = new Employees(req.body);
    const result = await newEmployee.save();

    if (!result) {
      return sendResponse(res, 400, "Unable to save the new employee", null);
    }

    sendResponse(res, 200, "New employee created successfully", result);
  } catch (err) {
    console.error(err);
    sendResponse(res, 500, "Something went wrong!", null);
  }
});


// UPDATE api/Employees
router.put('/:id', authenticateJWT, async (req, res) => {
  console.log("update employee called")
  try {
    const updatedEmployee = await Employees.findByIdAndUpdate(req.params.id, req.body, { new: true });
    console.log(updatedEmployee);
    if (!updatedEmployee) {
      return sendResponse(res, 404, "No employee found with this id", null);
    }

    sendResponse(res, 200, "Employee updated successfully", updatedEmployee);
  } catch (err) {
    console.error(err);
    sendResponse(res, 500, "Failed to update employee record", null);
  }
});


module.exports = router;
