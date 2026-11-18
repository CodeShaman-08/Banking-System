const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [ true, "Token is required"],
    unique: [true, "Token is already blacklisted"]
    },
},{
  timestamps: true
});
tokenBlacklistSchema.index({ blacklistedAt: 1 }, { expireAfterSeconds: 3600 });

const tokenBlackListModel = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = tokenBlackListModel;