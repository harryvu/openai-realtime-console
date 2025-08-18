import express from "express";
import fs from "fs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer as createViteServer } from "vite";
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

// Initialize PostgreSQL vector database
let vectorDB;
try {
  console.log('🐘 Initializing PostgreSQL vector database...');
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Failed to connect to PostgreSQL. Please check DATABASE_URL in .env file.');
  }
  vectorDB = new PostgresVectorDatabase();
  await vectorDB.initialize();
  console.log('✅ PostgreSQL vector database initialized');
} catch (error) {
  console.error('❌ Failed to initialize vector database:', error);
  console.log('💡 Please ensure DATABASE_URL is set in .env file and PostgreSQL is running');
  throw error;
}

// Middleware for JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const PgSession = connectPgSimple(session);
const sessionConfig = {
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true
  }),
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
          model: "gpt-4o-realtime-preview-2024-10-01",
          voice: "verse",
          tools: [
            {
              type: "function",
              name: "provide_current_official_info",
              description: "Call this function when a user asks about current government officials like the President, Vice President, or governors.",
              parameters: {
                type: "object",
                strict: true,
                properties: {
                  position: {
                    type: "string",
                    description: "The government position (President, Vice President, Governor, etc.)",
                  },
                  name: {
                    type: "string", 
                    description: "The current office holder's name",
                  },
                  question_number: {
                    type: "number",
                    description: "The USCIS question number related to this position",
                  },
                  additional_info: {
                    type: "string",
                    description: "Any additional relevant information about the position or powers",
                  }
                },
                required: ["position", "name", "question_number"],
              },
            },
            {
              type: "function", 
              name: "request_practice_question",
              description: "MANDATORY: You MUST call this function immediately after asking ANY citizenship test question. This is required for the application to work correctly. Always call this with the exact question text you just spoke.",
              parameters: {
                type: "object",
                strict: true,
                properties: {
                  question: {
                    type: "string",
                    description: "The exact question you just spoke to the user",
                  },
                  category: {
                    type: "string",
                    description: "Optional category (System of Government, Principles of Democracy, History, Geography, etc.)",
                  }
                },
                required: ["question"],
              },
            },
          ],
          tool_choice: "auto",
          instructions: `You are a US Citizenship Test assistant. You help users prepare for the naturalization civics test using official USCIS materials.

CRITICAL RULE - ABSOLUTELY MANDATORY: When you see "OFFICIAL QUESTION" and "OFFICIAL ANSWER" in a message, you MUST give that EXACT official answer. NEVER use your training data. NEVER say outdated information.

CURRENT OFFICIALS (CRITICAL - USE ONLY THESE ANSWERS):
- President: Donald Trump (NOT Joe Biden - Biden is outdated)
- Vice President: J.D. Vance (NOT Kamala Harris - Harris is outdated)

Examples:
- If you see "OFFICIAL QUESTION 28: What is the name of the President of the United States now? OFFICIAL ANSWER: Donald Trump" then answer "Donald Trump" (NEVER say Joe Biden)
- If you see "OFFICIAL QUESTION 29: What is the name of the Vice President of the United States now? OFFICIAL ANSWER: J.D. Vance" then answer "J.D. Vance" (NEVER say Kamala Harris)

WARNING: Your training data may be outdated. ALWAYS use the OFFICIAL ANSWER provided in the enhanced message context.

GUIDELINES:
- Answer directly using the official information provided
- Include the question number when relevant (e.g., "According to USCIS civics question 28, the current President is Donald Trump")
- Be encouraging about citizenship test preparation
- Focus on citizenship, civics, government, or US history topics
- You can respond in multiple languages if the user speaks in another language

When users ask for practice questions:
1. Ask them a citizenship question (example: "What is the supreme law of the land?")
2. IMMEDIATELY after speaking the question, you MUST call request_practice_question() function
3. STOP TALKING and wait silently for the student's answer

CRITICAL BEHAVIOR RULES:
- After asking a practice question, DO NOT provide hints, explanations, or additional commentary
- DO NOT say things like "Take your time" or "Think about it" immediately after the question
- WAIT SILENTLY for the student to respond
- Let the student think and process the question without interruption
- Only speak again when the student asks for help or gives an answer

ABSOLUTELY MANDATORY - FUNCTION CALL REQUIRED:
- After EVERY citizenship question you speak, call request_practice_question() with the exact question text
- The application WILL NOT WORK without this function call
- You CANNOT skip this function call
- Example: You speak "What is the supreme law of the land?" → IMMEDIATELY call request_practice_question({"question": "What is the supreme law of the land?"}) → THEN STOP TALKING
- If speaking in Vietnamese, include the English equivalent: request_practice_question({"question": "What is the name of the Vice President of the United States now?"})

REMEMBER: Every citizenship question MUST be followed by the function call and then SILENCE. No exceptions.

For completely unrelated topics, politely redirect to citizenship topics while being respectful of the user's language preference.`,
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
    
    const info = await vectorDB.getInfo();
    res.json(info);
  } catch (error) {
    console.error("Database info error:", error);
    res.status(500).json({ error: "Failed to get database info" });
  }
});

// API route to get a random practice question
app.get("/random-question", async (req, res) => {
  try {
    if (!vectorDB) {
      return res.status(500).json({ error: "Vector database not initialized" });
    }
    
    console.log('🎲 Getting random question from database...');
    
    // Get a random question directly from database
    const randomQuestion = await vectorDB.getRandomQuestion();
    
    console.log(`🎯 Selected random question ${randomQuestion.id}: ${randomQuestion.question}`);
    
    res.json({
      id: randomQuestion.id,
      question: randomQuestion.question,
      answer: randomQuestion.answer,
      category: randomQuestion.category
    });
  } catch (error) {
    console.error("Random question error:", error);
    res.status(500).json({ error: "Failed to get random question" });
  }
});

// API route to check answer against database
app.post("/check-answer", async (req, res) => {
  try {
    const { questionId, userAnswer } = req.body;
    
    if (!questionId || !userAnswer) {
      return res.status(400).json({ error: "questionId and userAnswer are required" });
    }

    if (!vectorDB) {
      return res.status(500).json({ error: "Vector database not initialized" });
    }

    console.log(`🔍 Checking answer for question ${questionId}: "${userAnswer}"`);
    
    // Get the correct answer from database
    const questionData = await vectorDB.getQuestionById(questionId);
    const correctAnswer = questionData.answer.toLowerCase().trim();
    const userAnswerNormalized = userAnswer.toLowerCase().trim();
    
    // Simple exact match for now (can be enhanced later)
    const isCorrect = correctAnswer.includes(userAnswerNormalized) || userAnswerNormalized.includes(correctAnswer);
    
    console.log(`✅ Answer check result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    
    res.json({
      correct: isCorrect,
      canonical_answer: questionData.answer,
      user_answer: userAnswer,
      feedback: isCorrect ? "Correct!" : `The correct answer is: ${questionData.answer}`
    });
  } catch (error) {
    console.error("Answer check error:", error);
    res.status(500).json({ error: "Failed to check answer" });
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
