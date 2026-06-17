const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists with Google ID
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
          // User found, update last login
          user.lastLogin = new Date();
          user.loginCount += 1;
          await user.save();
          return done(null, user);
        }

        // Check if user exists with same email
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.authProvider = 'google';
          user.isEmailVerified = true;
          user.profilePicture = profile.photos?.[0]?.value || user.profilePicture;
          user.lastLogin = new Date();
          user.loginCount += 1;
          await user.save();
          return done(null, user);
        }

        // Create new user
        const nameParts = profile.displayName.split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newUser = await User.create({
          firstName,
          lastName,
          email: profile.emails[0].value,
          googleId: profile.id,
          authProvider: 'google',
          profilePicture: profile.photos?.[0]?.value || null,
          isEmailVerified: true,
          isActive: true,
          lastLogin: new Date(),
          loginCount: 1
        });

        return done(null, newUser);

      } catch (error) {
        console.error('Google Strategy Error:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize/Deserialize for session (if using sessions)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = { generateToken };