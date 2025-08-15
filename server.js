import express from "express";
import fs from "fs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer as createViteServer } from "vite";
import { SimpleVectorDatabase } from "./lib/simpleVectorDatabase.js";
import { PostgresVectorDatabase } from "./lib/postgresVectorDatabase.js";
import { testConnection } from "./lib/db/connection.js";
import { prepareEnhancedMessage, isCitizenshipRelated, isCurrentOfficialsQuery } from "./lib/ragUtils.js";
import passport from "./lib/auth/passport-config.js";
import { optionalAuth, attachUser } from "./lib/auth/middleware.js";
import { createDevUser } from "./lib/auth/dev-auth.js";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Determine which database to use
const USE_POSTGRES = process.env.DATABASE_URL && process.env.USE_POSTGRES !== 'false';

// Initialize vector database
let vectorDB;
try {
  if (USE_POSTGRES) {
    console.log('🐘 Using PostgreSQL vector database...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL');
    }
    vectorDB = new PostgresVectorDatabase();
    await vectorDB.initialize();
    console.log('✅ PostgreSQL vector database initialized');
  } else {
    console.log('📄 Using JSON vector database...');
    vectorDB = new SimpleVectorDatabase();
    await vectorDB.initialize();
    console.log('✅ JSON vector database initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize vector database:', error);
  console.log('💡 Tip: Set DATABASE_URL in .env to use PostgreSQL, or ensure JSON database exists');
}

// Middleware for JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const PgSession = connectPgSimple(session);
const sessionConfig = {
  store: USE_POSTGRES ? new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true
  }) : undefined,
  secret: process.env.SESSION_SECRET || 'citizenship-test-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
};

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Attach user info to all requests
app.use(attachUser);

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// Authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login?error=facebook' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.get('/auth/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));
app.get('/auth/microsoft/callback',
  passport.authenticate('microsoft', { failureRedirect: '/login?error=microsoft' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
});

// Development authentication (only in development)
app.post('/auth/dev', createDevUser);

// User info API endpoint
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      userId: req.user.userId,
      email: req.user.email,
      name: req.user.name,
      provider: req.user.provider,
      createdAt: req.user.createdAt
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// API route for token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
          voice: "verse",
          instructions: `You are a US Citizenship Test assistant. You help users prepare for the naturalization civics test using official USCIS materials.

CRITICAL RULE: When you see "OFFICIAL QUESTION" and "OFFICIAL ANSWER" in a message, you MUST give that exact official answer. Do not ask for more context.

Examples:
- If you see "OFFICIAL QUESTION 21: Who is the President of the United States now? OFFICIAL ANSWER: Donald Trump" then answer "Donald Trump"
- If you see "OFFICIAL QUESTION 22: Who is the Vice President of the United States now? OFFICIAL ANSWER: J.D. Vance" then answer "J.D. Vance"

GUIDELINES:
- Answer directly using the official information provided
- Include the question number when relevant (e.g., "According to USCIS civics question 21, the current President is Donald Trump")
- Be encouraging about citizenship test preparation
- Only discuss citizenship, civics, government, or US history topics

For non-citizenship topics, redirect: "I'm specialized in US citizenship test preparation. Let me help you with American civics, government, or history instead. What would you like to know about the citizenship test?"`,
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// API route for semantic search
app.post("/search", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }
    
    if (!vectorDB) {
      return res.status(500).json({ error: "Vector database not initialized" });
    }
    
    console.log(`🔍 Search request: "${query}"`);
    
    const results = await vectorDB.search(query, limit);
    
    res.json({
      query: query,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// API route to get database info
app.get("/search/info", async (req, res) => {
  try {
    if (!vectorDB) {
      return res.status(500).json({ error: "Vector database not initialized" });
    }
    
    const info = vectorDB.getInfo();
    res.json(info);
  } catch (error) {
    console.error("Database info error:", error);
    res.status(500).json({ error: "Failed to get database info" });
  }
});

// API route for enhanced message preparation (RAG)
app.post("/enhance-message", async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message parameter is required" });
    }
    
    if (!vectorDB) {
      return res.status(500).json({ error: "Vector database not initialized" });
    }
    
    console.log(`💬 Enhancing message: "${message}"`);
    
    // Check if the message is citizenship-related
    const isRelevant = isCitizenshipRelated(message);
    
    if (!isRelevant) {
      return res.json({
        originalMessage: message,
        enhancedMessage: message,
        hasContext: false,
        warning: "This question doesn't appear to be citizenship-related. The assistant will redirect to citizenship topics."
      });
    }
    
    // Check if this is specifically about current officials (needs more results)
    const isAboutCurrentOfficials = isCurrentOfficialsQuery(message);
    const searchLimit = isAboutCurrentOfficials ? 5 : 3;
    
    // Perform semantic search to get relevant context
    const searchResults = await vectorDB.search(message, searchLimit);
    
    // Prepare enhanced message with context
    const enhanced = prepareEnhancedMessage(message, searchResults);
    
    res.json({
      originalMessage: message,
      enhancedMessage: enhanced.message,
      hasContext: enhanced.hasContext,
      contextSize: enhanced.contextSize || 0,
      searchResults: searchResults
    });
  } catch (error) {
    console.error("Message enhancement error:", error);
    res.status(500).json({ error: "Failed to enhance message" });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
