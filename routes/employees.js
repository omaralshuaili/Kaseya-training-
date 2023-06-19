const express = require('express');
const router = express.Router();
const {Employees} = require('../models/employeesModel'); 

const {authenticateJWT} = require("../helpers/middleware")
const {sendResponse} = require("../helpers/responseHandler")

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
    sendResponse(res,500,"Something went wrong ! ",null)
  }
});

router.post('/', authenticateJWT,async (req,res) =>{
  try{
    
  }
  catch{

  }


})


module.exports = router;
