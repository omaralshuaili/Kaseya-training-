const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  refreshToken: [{
    type: String,
    required: true,
  }],
  jwtid: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
});


const RefreshTokens = mongoose.model('RefreshTokens', refreshTokenSchema);

exports.RefreshTokens = RefreshTokens;
