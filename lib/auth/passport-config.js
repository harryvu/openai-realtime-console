import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { db } from '../db/connection.js';
import { userProfiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, id))
      .limit(1);
    
    if (user.length > 0) {
      done(null, user[0]);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email found in Google profile'), null);
      }

      // Check if user already exists
      let existingUser = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, profile.id))
        .limit(1);

      if (existingUser.length > 0) {
        return done(null, existingUser[0]);
      }

      // Create new user
      const newUser = await db
        .insert(userProfiles)
        .values({
          userId: profile.id,
          email: email,
          name: profile.displayName || email,
          provider: 'google',
        })
        .returning();

      return done(null, newUser[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email found in Facebook profile'), null);
      }

      // Check if user already exists
      let existingUser = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, profile.id))
        .limit(1);

      if (existingUser.length > 0) {
        return done(null, existingUser[0]);
      }

      // Create new user
      const newUser = await db
        .insert(userProfiles)
        .values({
          userId: profile.id,
          email: email,
          name: profile.displayName || email,
          provider: 'facebook',
        })
        .returning();

      return done(null, newUser[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Microsoft OAuth Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: "/auth/microsoft/callback",
    scope: ['user.read']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
      if (!email) {
        return done(new Error('No email found in Microsoft profile'), null);
      }

      // Check if user already exists
      let existingUser = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, profile.id))
        .limit(1);

      if (existingUser.length > 0) {
        return done(null, existingUser[0]);
      }

      // Create new user
      const newUser = await db
        .insert(userProfiles)
        .values({
          userId: profile.id,
          email: email,
          name: profile.displayName || email,
          provider: 'microsoft',
        })
        .returning();

      return done(null, newUser[0]);
    } catch (error) {
      return done(error, null);
    }
  }));
}

export default passport;