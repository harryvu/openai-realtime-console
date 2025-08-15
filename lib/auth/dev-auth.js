// Development authentication for testing purposes
// This creates a mock user for development when OAuth providers are not configured

import { db } from '../db/connection.js';
import { userProfiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function createDevUser(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Development auth not available in production' });
  }

  try {
    const devUserId = 'dev-user-123';
    const devEmail = 'developer@test.com';
    
    // Check if dev user already exists
    let existingUser = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, devUserId))
      .limit(1);

    let user;
    if (existingUser.length > 0) {
      user = existingUser[0];
    } else {
      // Create dev user
      const newUser = await db
        .insert(userProfiles)
        .values({
          userId: devUserId,
          email: devEmail,
          name: 'Development User',
          provider: 'development',
        })
        .returning();
      user = newUser[0];
    }

    // Log the user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }
      res.json({ 
        success: true, 
        message: 'Development login successful',
        user: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          name: user.name,
          provider: user.provider
        }
      });
    });

  } catch (error) {
    console.error('Development auth error:', error);
    res.status(500).json({ error: 'Development auth failed' });
  }
}