# Authentication System

This document describes the comprehensive authentication system implemented for the US Citizenship Test Assistant.

## Overview

The application uses **Passport.js** with social OAuth providers (Google, Facebook, Microsoft) and PostgreSQL session storage for user authentication and authorization.

## Architecture

### Technology Stack
- **Passport.js**: Authentication middleware for Node.js
- **OAuth 2.0**: Social login with Google, Facebook, Microsoft
- **PostgreSQL**: User profiles and session storage
- **Express Session**: Session management with database persistence
- **React Context**: Frontend authentication state management

### Database Schema

#### User Profiles (`user_profiles`)
```sql
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,     -- OAuth provider user ID
  email TEXT NOT NULL UNIQUE,       -- User email address
  name TEXT NOT NULL,               -- Display name
  provider TEXT NOT NULL,           -- 'google', 'facebook', 'microsoft', 'development'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Sessions (`session`)
- Automatically created by `connect-pg-simple`
- Stores encrypted session data in PostgreSQL
- 30-day session expiration

## Authentication Flow

### 1. Login Process
```
User → Login Page → OAuth Provider → Callback → User Profile Creation/Update → Dashboard
```

1. User clicks "Login with [Provider]"
2. Redirects to OAuth provider (Google/Facebook/Microsoft)
3. User authorizes application
4. Provider redirects back with authorization code
5. Server exchanges code for user profile data
6. Creates or updates user in database
7. Establishes session and redirects to dashboard

### 2. Session Management
- Sessions stored in PostgreSQL for persistence across server restarts
- Secure HTTP-only cookies
- Automatic session cleanup
- CSRF protection built-in

### 3. Logout Process
- Destroys server session
- Clears client-side cookies
- Redirects to home page

## Implementation Details

### Backend (Express + Passport.js)

#### OAuth Strategies (`/lib/auth/passport-config.js`)
```javascript
// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  // User creation/update logic
}));
```

#### Authentication Routes
- `GET /auth/google` - Initiate Google login
- `GET /auth/google/callback` - Google callback handler
- `GET /auth/facebook` - Initiate Facebook login
- `GET /auth/facebook/callback` - Facebook callback handler
- `GET /auth/microsoft` - Initiate Microsoft login
- `GET /auth/microsoft/callback` - Microsoft callback handler
- `POST /auth/logout` - Logout endpoint
- `GET /api/user` - Get current user info

#### Middleware (`/lib/auth/middleware.js`)
- `requireAuth`: Require authentication for protected routes
- `optionalAuth`: Attach user info if authenticated
- `attachUser`: Add user to response locals

### Frontend (React + Context)

#### Auth Context (`/client/contexts/AuthContext.jsx`)
```javascript
const { user, loading, login, logout, isAuthenticated } = useAuth();
```

#### Components
- `LoginPage`: Social login interface
- `AuthButton`: Login/logout button with user info
- `AppWithAuth`: Authentication-aware app wrapper

#### Protected Routes
The app automatically shows:
- **Login Page**: When user is not authenticated
- **Main App**: When user is authenticated
- **Loading State**: While checking authentication status

## Environment Configuration

### Required Variables
```bash
# Session Management
SESSION_SECRET="your-super-secret-session-key"

# OAuth Provider Credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

FACEBOOK_APP_ID="your-facebook-app-id"
FACEBOOK_APP_SECRET="your-facebook-app-secret"

MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

### OAuth Provider Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`

#### Facebook OAuth Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure redirect URI: `http://localhost:3000/auth/facebook/callback`

#### Microsoft OAuth Setup
1. Go to [Azure App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
2. Register a new application
3. Add web platform with redirect URI: `http://localhost:3000/auth/microsoft/callback`
4. Configure API permissions for user profile access

## Development & Testing

### Development Authentication
For testing without OAuth providers:
```bash
curl -X POST http://localhost:3000/auth/dev
```

This creates a test user and establishes a session (development mode only).

### Testing Authentication Flow
```bash
# Test unauthenticated access
curl http://localhost:3000/api/user
# Returns: {"error":"Not authenticated"}

# Login with development auth
curl -c cookies.txt -X POST http://localhost:3000/auth/dev

# Test authenticated access
curl -b cookies.txt http://localhost:3000/api/user
# Returns: {"id":1,"email":"developer@test.com",...}

# Logout
curl -b cookies.txt -X POST http://localhost:3000/auth/logout

# Verify logout
curl -b cookies.txt http://localhost:3000/api/user
# Returns: {"error":"Not authenticated"}
```

## Security Considerations

### Session Security
- HTTP-only cookies prevent XSS attacks
- Secure flag enabled in production
- PostgreSQL session storage for scalability
- 30-day session expiration

### OAuth Security
- State parameter for CSRF protection
- Secure redirect URI validation
- Proper scope limitations for each provider

### Database Security
- No password storage (OAuth only)
- User data validation and sanitization
- Prepared statements prevent SQL injection

## Future Enhancements

### Planned Features
1. **User Progress Tracking**: Connect authentication to test progress
2. **Role-Based Access**: Admin vs. regular user permissions
3. **Account Linking**: Allow multiple OAuth providers per user
4. **Session Analytics**: Track user engagement and study patterns

### Potential Integrations
1. **Azure AD B2C**: Enterprise authentication
2. **JWT Tokens**: Stateless authentication for API access
3. **Two-Factor Authentication**: Enhanced security option
4. **Account Deletion**: GDPR compliance features

## Troubleshooting

### Common Issues

#### OAuth Errors
- **Invalid redirect URI**: Check provider console configuration
- **Scope errors**: Verify requested permissions match provider setup
- **Token errors**: Check client ID/secret configuration

#### Session Issues
- **Session not persisting**: Verify PostgreSQL connection and session table
- **Logout not working**: Check cookie domain and path settings
- **Multiple sessions**: Expected behavior, each browser/device gets unique session

#### Database Issues
- **User creation failed**: Check database schema and constraints
- **Email conflicts**: Handled gracefully, updates existing user data

### Debug Mode
Set `DEBUG=passport:*` for detailed authentication logs:
```bash
DEBUG=passport:* npm run dev
```

## API Reference

### Authentication Endpoints

#### `GET /auth/{provider}`
Initiates OAuth flow for specified provider.

**Parameters:**
- `provider`: One of `google`, `facebook`, `microsoft`

**Response:**
- Redirects to OAuth provider

#### `GET /auth/{provider}/callback`
Handles OAuth callback from provider.

**Response:**
- Success: Redirects to `/dashboard`
- Error: Redirects to `/login?error={provider}`

#### `POST /auth/logout`
Destroys user session and logs out.

**Response:**
```json
{"success": true, "message": "Logged out successfully"}
```

#### `GET /api/user`
Returns current authenticated user information.

**Response (Authenticated):**
```json
{
  "id": 1,
  "userId": "google-123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "provider": "google",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Response (Unauthenticated):**
```json
{"error": "Not authenticated"}
```

#### `POST /auth/dev` (Development Only)
Creates test user for development/testing.

**Response:**
```json
{
  "success": true,
  "message": "Development login successful",
  "user": {
    "id": 1,
    "userId": "dev-user-123",
    "email": "developer@test.com",
    "name": "Development User",
    "provider": "development"
  }
}
```