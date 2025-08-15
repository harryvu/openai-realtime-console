# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**US Citizenship Test Assistant** - A specialized implementation of the OpenAI Realtime Console focused on US citizenship test preparation. This application uses Retrieval Augmented Generation (RAG) with a vector database to provide grounded answers based on official USCIS materials and the complete set of 100 official civics questions.

### Key Features
- **Complete USCIS Question Set**: All 100 official civics questions organized by categories
- **Current Officials Information**: Updated with current government officials (Donald Trump as President, J.D. Vance as Vice President)
- **RAG Integration**: Vector database with semantic search for grounded responses
- **Voice + Text Interaction**: Real-time voice conversations with fallback to text input
- **Citizenship-Focused**: Only responds to citizenship-related questions using official USCIS materials

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build both client and server for production
- `npm run build:client` - Build React client only
- `npm run build:server` - Build SSR server only
- `npm run lint` - Run ESLint with auto-fix

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
- **RAG Endpoints**:
  - `/search` - Search vector database for citizenship questions
  - `/enhance-message` - Enhance user messages with relevant USCIS context
  - `/search/info` - Get database status and info
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

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` before running.

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Express, Vite SSR
- **API**: OpenAI Realtime API via WebRTC
- **Vector Database**: Custom SimpleVectorDatabase with OpenAI embeddings (text-embedding-3-small)
- **RAG**: Semantic search with cosine similarity
- **Data**: Complete USCIS 100 civics questions with current officials
- **Styling**: TailwindCSS with PostCSS

## RAG System Architecture

### Vector Database (`/lib/simpleVectorDatabase.js`)
- Custom implementation with JSON file persistence (`./data/vector_database.json`)
- Uses OpenAI `text-embedding-3-small` model for embeddings
- Cosine similarity search with configurable result limits
- 100 official USCIS questions with metadata (question_id, category, official answers)

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

## Usage Notes

The application automatically enhances all user messages with relevant USCIS context using RAG. The system is specifically designed to:
1. Only respond to citizenship test-related questions
2. Ground all responses in official USCIS materials
3. Provide current government officials information
4. Support both voice and text interactions with semantic search