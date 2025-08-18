# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**US Citizenship Test Assistant** - A specialized implementation of the OpenAI Realtime Console focused on US citizenship test preparation. This application uses Retrieval Augmented Generation (RAG) with a vector database to provide grounded answers based on official USCIS materials and the complete set of 100 official civics questions.

### Key Features
- **Database-Driven Practice Questions**: State-based system that pulls random questions from PostgreSQL database as single source of truth
- **Complete USCIS Question Set**: All 100 official civics questions organized by categories
- **Current Officials Information**: Updated with current government officials (Donald Trump as President, J.D. Vance as Vice President)
- **RAG Integration**: Vector database with semantic search for grounded responses
- **Voice + Text Interaction**: Real-time voice conversations with fallback to text input
- **State-Based Function Calling**: Reliable function calling using simple state machine to prevent AI confusion
- **Answer Validation System**: Database lookup for correct answers with synonym matching
- **Citizenship-Focused**: Only responds to citizenship-related questions using official USCIS materials

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build React client only
- `npm run build:server` - Build SSR server only
- `npm run lint` - Run ESLint with auto-fix

### Database Commands
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations  
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio for database management

## Architecture

### Unified Single-Port Architecture
**Port 3000** - Single Express server handles both frontend and backend:
```
┌─────────────────────────────────────┐
│     Single Express Server :3000     │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Vite SSR  │  │  API Routes │  │
│  │ (React App) │  │ /token      │  │
│  │             │  │ /search     │  │
│  │             │  │ /enhance-*  │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### Server (server.js)
- **Unified Architecture**: Single Express server on port 3000
- **Vite Development Middleware**: Serves React frontend with SSR
- **No Port Conflicts**: Frontend and backend on same origin (no CORS issues)
- `/token` endpoint generates OpenAI Realtime API session tokens with citizenship-specific instructions
- Uses `gpt-4o-realtime-preview-2025-06-03` model with "verse" voice
- gpt-4o-mini-realtime-preview-2024-12-17 is cheaper
- **RAG Endpoints**:
  - `/search` - Search vector database for citizenship questions
  - `/enhance-message` - Enhance user messages with relevant USCIS context
  - `/search/info` - Get database status and info
- **Practice Question Endpoints**:
  - `/random-question` - Get random question from database for practice
  - `/check-answer` - Validate user answers against database
- Vector database integration with automatic context injection
- **Request Routing**:
  - `http://localhost:3000/` → React App (via Vite SSR)
  - `http://localhost:3000/search` → API endpoint
  - `http://localhost:3000/token` → API endpoint

### Client Architecture
- **Entry Points**: `entry-client.jsx` (hydration), `entry-server.jsx` (SSR)
- **Main App**: `App.jsx` manages WebRTC peer connection and data channel
- **Key Components**:
  - `SessionControls` - Start/stop session, send messages
  - `EventLog` - Display client/server event streams
  - `CitizenshipTestPanel` - Citizenship-focused interface with search and quick actions

### WebRTC Flow
1. Fetch session token from `/token` endpoint
2. Create RTCPeerConnection with audio track (microphone)
3. Establish data channel named "oai-events"
4. Exchange SDP offer/answer with OpenAI Realtime API
5. Send/receive events via data channel

### State Management
- Session state managed in `App.jsx` with useState/useRef
- Events array stores chronological client/server messages
- Data channel handles bidirectional communication

## Environment Setup

Copy `.env.example` to `.env` and configure required variables:

### Required Variables
- `OPENAI_API_KEY` - Your OpenAI API key for embeddings and Realtime API
- `DATABASE_URL` - PostgreSQL connection string (required for vector database)

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Express, Vite SSR
- **API**: OpenAI Realtime API via WebRTC
- **Database**: PostgreSQL with pg_vector extension
- **ORM**: Drizzle ORM with type-safe queries and migrations
- **Vector Database**: PostgreSQL with pg_vector extension for semantic search
- **RAG**: Semantic search with cosine similarity using OpenAI embeddings (text-embedding-3-small)
- **Data**: Complete USCIS 100 civics questions with current officials
- **Styling**: TailwindCSS with PostCSS

## RAG System Architecture

### PostgreSQL Vector Database (`/lib/postgresVectorDatabase.js`)
- Production-ready implementation using PostgreSQL with pg_vector extension
- Drizzle ORM for type-safe database operations
- Native vector similarity search with cosine distance
- User analytics and search query logging
- Automatic database schema management and migrations

### Database Interface
The PostgreSQL vector database provides these APIs:
- `initialize()` - Set up database connection and schema
- `ingestDocuments(docs)` - Add documents with automatic embedding generation
- `search(query, limit)` - Semantic search with similarity scoring
- `getInfo()` - Database statistics and status information
- `getRandomQuestion()` - Get random question for practice sessions
- `getQuestionById(id)` - Retrieve specific question and answer by ID

### RAG Utilities (`/lib/ragUtils.js`)
- Message enhancement with semantic search results
- Context formatting for optimal AI grounding
- Citizenship question filtering and validation

### Data Processing (`/scripts/processDocuments.js`)
- Complete USCIS 100 civics questions organized by categories:
  - Principles of Democracy (Questions 1-12)
  - System of Government (Questions 13-47)
  - Rule of Law (Questions 48-57)
  - Colonial Period and Independence (Questions 58-70)
  - Independence (Questions 71-77)
  - 1900s (Questions 78-87)
  - Geography (Questions 88-95)
  - Symbols (Questions 96-98)
  - Holidays (Questions 99-100)
- Current officials: Donald Trump (President), J.D. Vance (Vice President)

### Key Question Numbers
- **Question 28**: Current President (Donald Trump)
- **Question 29**: Current Vice President (J.D. Vance)
- **Question 46**: Presidential party (Republican)

## Practice Question Flow Architecture

### State-Based System
The practice question system uses a simple state machine to ensure reliable function calling:

```
IDLE → GET_QUESTION → DISPLAY_QUESTION → AWAIT_ANSWER → EVALUATE → IDLE
```

### Function Definitions

#### `get_random_question()`
- **Purpose**: Fetch random question from PostgreSQL database
- **Server Logic**: Query `civics_questions` table with random selection
- **Returns to AI**: `{id: string, question: string}` (answer excluded to prevent spoilers)
- **Database Fields**: Full record includes `{id, questionId, question, answer, category}`

#### `show_practice_question(id, question)`  
- **Purpose**: Display question in Practice Question sidebar UI
- **Client Logic**: Updates sidebar with question text and "Show Answer" button
- **Voice Integration**: AI speaks question aloud in user's preferred language
- **State Tracking**: Enables answer checking for specific question ID

#### `check_answer(id, user_answer)`
- **Purpose**: Validate user's answer against database ground truth
- **Server Logic**: Database lookup + string normalization + synonym matching
- **Returns**: `{correct: boolean, canonical_answer: string, feedback: string}`
- **Fallback**: Uses simple exact match and common synonyms

### Practice Question Workflow

1. **User Request**: "Give me a practice question"
2. **AI Action**: Calls `get_random_question()`
3. **Server Response**: Returns random question from database (answer withheld)
4. **AI Behavior**: 
   - Speaks question aloud (in user's language)
   - Calls `show_practice_question(id, question)` to populate sidebar
   - Does NOT provide answer until requested
5. **User Response**: Provides answer or asks for correct answer
6. **Answer Validation**: 
   - If user answers: Call `check_answer(id, user_answer)`
   - If user asks: Retrieve answer from database by ID
7. **Feedback Loop**: AI provides feedback and asks "Would you like another question?"

### Database as Single Source of Truth

- **No AI Memory**: AI never invents or remembers questions
- **Consistency Guaranteed**: Voice and sidebar always show same question text  
- **All 100 Questions**: Random selection from complete USCIS civics test
- **Current Officials**: Database updated with current government information
- **Multilingual Support**: AI translates questions for voice while database remains English

## Function Calling Reliability

### Best Practices Discovered

**✅ What Works for Reliable Function Calling:**
- **Single-purpose functions**: Each function does one thing only
- **Simple instructions**: Minimal cognitive load on AI
- **State enforcement**: Use `tool_choice` to force specific functions per state
- **Clear separation**: Keep voice/UI concerns separate from function logic

**❌ What Breaks Function Calling:**
- Complex multi-step instructions in prompts
- Mixed responsibilities (e.g., "speak AND call function AND check this")
- Long lists of requirements or edge cases
- Cognitive overload from too many simultaneous concerns

### Implementation Strategy

1. **Minimal Prompts**: Each state has simple, single-purpose instruction
2. **Forced Tool Use**: `tool_choice` parameter ensures function calls happen
3. **Client-Side Voice**: TTS handled by client, not AI planning
4. **Database Isolation**: AI never sees answers during question phase

## Usage Notes

The application automatically enhances all user messages with relevant USCIS context using RAG. The system is specifically designed to:
1. Use database-driven practice questions for consistency and reliability
2. Only respond to citizenship test-related questions  
3. Ground all responses in official USCIS materials
4. Provide current government officials information
5. Support both voice and text interactions with semantic search

## Troubleshooting

### Practice Question Issues

**Problem**: Practice Questions not appearing in sidebar
**Cause**: AI not calling `get_random_question()` or `show_practice_question()` functions
**Solution**: 
- Check AI instructions are simple and single-purpose
- Verify `tool_choice` is properly configured to force function calls
- Avoid complex multi-step instructions that confuse the AI

**Problem**: Voice and sidebar show different questions
**Cause**: AI inventing questions instead of using database
**Solution**: 
- Ensure AI calls `get_random_question()` first before speaking
- Database must be single source of truth - AI should never invent questions
- Check that answer is excluded from AI context during question phase

**Problem**: AI provides answers immediately after questions
**Cause**: AI has access to answer data during question phase
**Solution**:
- Server must strip answer from response when returning to AI
- AI should only get `{id, question}` during DISPLAY_QUESTION state
- Answer only provided during EVALUATE state or when explicitly requested

### Function Calling Reliability

**Best Practices**:
- Keep AI instructions under 50 words per state
- Use single-purpose functions (one function = one responsibility)
- Enforce function calls with `tool_choice` parameter
- Handle voice/UI logic client-side, not in AI prompts
- Test with simple instructions first, add complexity gradually

**Common Failures**:
- Instructions with multiple "AND" clauses break function calling
- Long examples or edge cases confuse the AI
- Mixing voice timing with function logic causes unreliability
- Complex state transitions should be handled server-side, not in prompts