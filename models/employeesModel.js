const mongoose = require('mongoose');

const employeesSchema = new mongoose.Schema({
    
    firstName : {
        type: String,
    },
    lastName : {
        type: String,
    },
    DOB: {
        type:Date,
    },
    email:{
        type:String
    },
    skillLevel: { 
    type: mongoose.Schema.Types.ObjectId, ref: 'SkillLevel' 
    },
})


const Employees = mongoose.model('Employees',employeesSchema);
exports.Employees = Employees

