const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    Username : {
        type: String,
        required: true,
    },
    Password : {
        type: String,
        required: true
    },
    dateCreated: {
        type:Date,
        default:Date.now
    },
    attempts:{
        type:Number,
        default:0
    },
    locked:{
        type:Boolean,
        default:false
    },
    emailToken:{
        type:String
    },
    isVerified:{
        type:Boolean,
        default:false
    }
})


const Users = mongoose.model('Users',userSchema);
exports.Users = Users

