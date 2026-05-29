const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  name: { type:String, required:true, trim:true },
  username: { type:String, required:true, unique:true, lowercase:true, trim:true },
  email: { type:String, required:true, unique:true, lowercase:true },
  password: { type:String, minlength:6, select:false },
  role: { type:String, enum:['user','admin'], default:'user' },
  plan: { type:String, enum:['free','starter','pro','team'], default:'free' },
  planLimits: { maxServices:{type:Number,default:3}, maxDatabases:{type:Number,default:1}, maxMemoryMB:{type:Number,default:512}, buildMinutes:{type:Number,default:400} },
  githubUsername: String,
  notificationPrefs: { deploySuccess:{type:Boolean,default:true}, deployFail:{type:Boolean,default:true}, serviceDown:{type:Boolean,default:true}, email:{type:Boolean,default:true} },
  apiKeys: [{ name:String, key:String, createdAt:Date, lastUsed:Date }],
  resetPasswordToken: { type:String, select:false },
  resetPasswordExpire: { type:Date, select:false },
  emailVerified: { type:Boolean, default:false },
  lastLogin: Date,
  isActive: { type:Boolean, default:true },
  billingEmail: String,
  usageStats: { totalDeploys:{type:Number,default:0}, buildMinutesUsed:{type:Number,default:0} }
}, { timestamps:true });
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12); next();
});
userSchema.methods.comparePassword = function(p) { return bcrypt.compare(p, this.password); };
userSchema.methods.toSafeObject = function() {
  const o = this.toObject();
  delete o.password; delete o.resetPasswordToken; delete o.resetPasswordExpire;
  return o;
};
module.exports = mongoose.model('User', userSchema);
