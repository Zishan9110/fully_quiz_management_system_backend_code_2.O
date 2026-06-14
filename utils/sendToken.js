const jwt = require('jsonwebtoken');

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_ACCESS_EXPIRE || '30d'
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '90d'
  });
};

const sendToken = (user, statusCode, res, isAdmin = false) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const cookieName = isAdmin ? 'adminAccessToken' : 'accessToken';
  const refreshCookieName = isAdmin ? 'adminRefreshToken' : 'refreshToken';
  
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };
  
  res.cookie(cookieName, accessToken, cookieOptions);
  res.cookie(refreshCookieName, refreshToken, cookieOptions);

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    data: user
  });
};

module.exports = { sendToken, generateAccessToken, generateRefreshToken };