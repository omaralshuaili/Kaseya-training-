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
    }
})


const Users = mongoose.model('Users',userSchema);
exports.Users = Users

