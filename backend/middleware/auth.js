const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = async (req,res,next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error:'Token required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error:'Invalid user' });
    req.user = user; next();
  } catch(e) { return res.status(401).json({ error:'Invalid token' }); }
};
const requireAdmin = (req,res,next) => { if (req.user?.role!=='admin') return res.status(403).json({ error:'Admin only' }); next(); };
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE||'7d' });
module.exports = { authenticateToken, requireAdmin, generateToken };
