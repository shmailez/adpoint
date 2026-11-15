const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  email: { type: String },
  avatar: { type: String },
  balance: { type: Number, default: 0 },
  history: [{
    label: String,
    points: Number,
    time: { type: Date, default: Date.now }
  }],
  lastDaily: { type: String, default: null },
  tasksDone: { type: Map, of: Boolean, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);