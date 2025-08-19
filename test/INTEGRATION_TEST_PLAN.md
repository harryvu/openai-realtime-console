# Integration Test Plan - US Citizenship Test Assistant

## Core User Journeys to Test

### 1. **Practice Question Flow** (Most Critical)
```
User Request → AI Response → Function Call → Database Lookup → Sidebar Display → Answer Reveal
```

**Test Scenarios:**
- ✅ User asks "Give me a practice question" → AI provides question → Sidebar shows question card
- ✅ User answers question → System validates against database → Shows correct/incorrect feedback  
- ✅ User clicks "Show Answer" → Reveals official answer from database
- ✅ User asks for another question → Previous question cleared → New question displayed
- ✅ No duplicate processing (function calls only processed once)

### 2. **Multilingual Support**
```
English Question → Vietnamese Translation → Database Matching → Consistent Results
```

**Test Scenarios:**
- ✅ User asks question in Vietnamese → AI translates → Matches English database entry
- ✅ Voice speaks Vietnamese → Sidebar shows English question text → Database lookup works
- ✅ Language switching mid-conversation → State maintained correctly
- ✅ Complex Vietnamese questions → Proper semantic search matching

### 3. **Session State Management**
```
Active Session → Pause → Resume → State Preservation/Reset
```

**Test Scenarios:**
- ✅ Practice question displayed → User pauses → Resume → Question preserved in sidebar
- ✅ Mid-conversation pause → Resume → New questions work correctly  
- ✅ Function call deduplication reset on resume → No stale processed IDs
- ✅ Timer management → Pause clears timers → Resume allows new timers

### 4. **Real Database Integration**
```
Search Query → Vector Database → Semantic Matching → Official USCIS Data
```

**Test Scenarios:**
- ✅ Current officials queries → Database returns "Donald Trump", "J.D. Vance"
- ✅ Semantic search works → Similar questions match correctly
- ✅ All 100 official questions accessible → Random question selection
- ✅ Answer validation → User answers checked against official answers
- ✅ Database connection resilience → Graceful failure handling

### 5. **Voice + Text Synchronization**
```
AI Speaks → Function Called → UI Updated → User Responds → Cycle Continues
```

**Test Scenarios:**
- ✅ AI speaks question → Sidebar updates simultaneously → No race conditions
- ✅ User responds via text → AI processes correctly → Voice responds
- ✅ Timer-based check-ins → AI speaks at appropriate times
- ✅ Function calling reliability → No dropped function calls

## Test Environment Requirements

### Real Services Integration
- **PostgreSQL Database**: Test database with full USCIS question set
- **Vector Search**: pgvector extension enabled, embeddings generated
- **OpenAI API**: Test API key for embeddings (not Realtime API in tests)
- **Express Server**: Full server stack running during tests

### Mock Only These External Services
- **OpenAI Realtime API**: WebRTC connections (too complex for integration tests)
- **Audio/Voice**: TTS/STT simulation
- **WebSocket connections**: Simulated event streams

## Test Data Strategy

### Database Seeded With:
- All 100 official USCIS civics questions
- Current officials: Trump, Vance, Newsom
- Vector embeddings pre-generated
- Categories and metadata complete

### Event Simulation:
- Realistic OpenAI response.done events
- Function call structures matching real API
- Timing that matches production behavior
- Error scenarios (network failures, malformed responses)

## Integration Test Files Structure

```
test/
├── unit/
│   └── ragUtils.unit.test.js                    ✅ Pure business logic
├── integration/
│   ├── practiceQuestionFlow.integration.test.js ⏳ Core user journey
│   ├── multilingualSupport.integration.test.js  ⏳ Language switching
│   ├── sessionState.integration.test.js         ⏳ Pause/resume behavior
│   ├── databaseIntegration.integration.test.js  ⏳ Real DB queries
│   └── voiceTextSync.integration.test.js        ⏳ Voice-UI coordination
└── e2e/
    ├── fullUserJourney.e2e.test.js              ⏳ Playwright end-to-end
    └── realTimeAPI.e2e.test.js                  ⏳ Full OpenAI integration
```

## Success Criteria

### Integration Tests Should:
1. **Run against real database** → Catch actual data/query issues
2. **Test full request/response cycles** → End-to-end functionality verified  
3. **Handle timing/async correctly** → No race conditions or timeouts
4. **Validate state transitions** → Session management works correctly
5. **Test error scenarios** → Graceful failure modes
6. **Run in CI reliably** → Stable, repeatable results

### What Integration Tests WON'T Test:
- WebRTC connection establishment (too complex)
- Actual OpenAI Realtime API calls (cost/reliability)
- Browser-specific behavior (Playwright handles this)
- Visual styling/layout (not business critical)

This approach tests the critical business logic and integration points while avoiding the fragile mocking that caused previous test failures.