// Authentication middleware functions

export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // For API requests, return 401
  if (req.path.startsWith('/api/') || req.path.startsWith('/search') || req.path.startsWith('/enhance-message')) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }
  
  // For web requests, redirect to login
  res.redirect('/login');
}

export function optionalAuth(req, res, next) {
  // Set user info if authenticated, but don't require it
  req.currentUser = req.user || null;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // For now, all authenticated users are admins
  // In the future, you could check user.role === 'admin'
  next();
}

export function attachUser(req, res, next) {
  // Attach user info to all requests for easy access
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
}