

const mongoose = require('mongoose');

const sklillLevelSchema = new mongoose.Schema({
    skillName: { 
        type: String
    },

    skillDescription: {
         type: String
    }

})


const SkillLevel = mongoose.model('SkillLevel',sklillLevelSchema);
exports.SkillLevel = SkillLevel

