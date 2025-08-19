# Test Environment Setup Guide

Complete guide for setting up and running the new integration-focused test suite for the US Citizenship Test Assistant.

## 🏗️ Test Architecture Overview

### Three-Tier Testing Strategy

1. **Unit Tests** - Pure business logic functions (RAG utilities)
2. **Integration Tests** - Real database + API integration 
3. **End-to-End Tests** - Full browser testing with Playwright

```
┌─────────────────┬──────────────────┬─────────────────┐
│   Unit Tests    │ Integration Tests│   E2E Tests     │
├─────────────────┼──────────────────┼─────────────────┤
│ • ragUtils.js   │ • Real Database  │ • Full Browser  │
│ • Pure Logic    │ • Vector Search  │ • User Journey  │
│ • Fast (< 1s)   │ • API Endpoints  │ • Cross-Browser │
│ • No External   │ • State Mgmt     │ • Visual Tests  │
│   Dependencies  │ • Function Calls │ • Performance   │
└─────────────────┴──────────────────┴─────────────────┘
```

## 🚀 Quick Start

### 1. Initial Setup
```bash
# Install dependencies (if not already done)
npm install

# Create test environment config
cp .env.test .env.test.local

# Edit .env.test.local with real values:
# DATABASE_URL="postgresql://citizenship_user:citizenship_pass@localhost:5434/citizenship_test_db"
# OPENAI_API_KEY="sk-your-test-api-key-here"
```

### 2. Start Test Database
```bash
# Start PostgreSQL test database
npm run test:setup

# Verify database is running
docker ps | grep citizenship_postgres_test
```

### 3. Run Tests
```bash
# Run all unit tests (fast)
npm run test:unit

# Run integration tests (requires database)
npm run test:integration  

# Run E2E tests (requires server running)
npm run test:e2e

# Run all tests
npm test
```

### 4. Cleanup
```bash
# Stop test database
npm run test:teardown
```

## 📋 Detailed Setup Instructions

### Prerequisites

1. **Node.js 18+** and **npm**
2. **Docker** and **Docker Compose**
3. **OpenAI API Key** (for embeddings in integration tests)
4. **PostgreSQL client tools** (optional, for debugging)

### Database Setup

#### Option 1: Docker (Recommended)
```bash
# Start test database container
npm run test:setup

# The database will be available at:
# Host: localhost
# Port: 5434 (different from dev database)
# Database: citizenship_test_db
# Username: citizenship_user  
# Password: citizenship_pass
```

#### Option 2: Local PostgreSQL
```bash
# Install pgvector extension
# Ubuntu/Debian: apt-get install postgresql-15-pgvector
# macOS: brew install pgvector

# Create test database
createdb citizenship_test_db

# Install pgvector extension
psql citizenship_test_db -c "CREATE EXTENSION vector;"
```

### Environment Configuration

Create `.env.test.local` with these values:

```bash
# Test Database - Use Docker port 5434
DATABASE_URL="postgresql://citizenship_user:citizenship_pass@localhost:5434/citizenship_test_db"

# OpenAI API for embeddings (required for vector search)
OPENAI_API_KEY="sk-test-your-openai-api-key-here"

# Session secret for tests  
SESSION_SECRET="test-session-secret-not-for-production"

# OAuth (optional for most tests)
GOOGLE_CLIENT_ID="test-google-client-id"
GOOGLE_CLIENT_SECRET="test-google-client-secret"

# Test-specific settings
NODE_ENV="test"
PORT="3001"
```

## 🧪 Test Types and Commands

### Unit Tests
**Purpose**: Test pure business logic functions
**Speed**: Fast (< 1 second)
**Dependencies**: None

```bash
npm run test:unit

# Tests RAG utilities:
# - Text formatting and processing
# - Keyword matching and classification  
# - Message enhancement logic
# - String parsing and extraction
```

### Integration Tests  
**Purpose**: Test complete user journeys with real services
**Speed**: Moderate (10-30 seconds)
**Dependencies**: PostgreSQL + Seeded Data + OpenAI API

```bash
# Ensure test database is running
npm run test:setup

# Run integration test suites
npm run test:integration

# Individual test suites:
npx jest test/practiceQuestionFlow.integration.test.js
npx jest test/multilingualSupport.integration.test.js  
npx jest test/sessionManagement.integration.test.js
npx jest test/databaseIntegration.integration.test.js
npx jest test/voiceTextSync.integration.test.js
```

**Integration Test Suites:**

1. **Practice Question Flow** (`practiceQuestionFlow.integration.test.js`)
   - Complete question → database lookup → sidebar display → answer validation
   - Function call deduplication 
   - Timer management
   - Error handling

2. **Multilingual Support** (`multilingualSupport.integration.test.js`)
   - Vietnamese → English question matching
   - Semantic search across languages
   - Voice-text language consistency
   - Mixed language handling

3. **Session Management** (`sessionManagement.integration.test.js`)
   - Pause/resume behavior
   - State preservation
   - Function call ID reset
   - Timer coordination

4. **Database Integration** (`databaseIntegration.integration.test.js`)
   - Real PostgreSQL vector search
   - Current officials data validation
   - Semantic similarity testing
   - API endpoint testing
   - Performance and reliability

5. **Voice-Text Synchronization** (`voiceTextSync.integration.test.js`)
   - AI speech → UI update coordination
   - Function call reliability
   - Race condition prevention
   - Error recovery

### End-to-End Tests
**Purpose**: Test complete user experience in real browsers
**Speed**: Slow (1-5 minutes)
**Dependencies**: Full application stack + Browsers

```bash
# Start the application (in another terminal)
npm start

# Run E2E tests
npm run test:e2e                # Headless
npm run test:e2e:headed         # With browser UI  
npm run test:e2e:debug          # Debug mode

# Test specific browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

**E2E Test Coverage:**
- Page load and asset loading
- Search functionality
- Responsive design (mobile/desktop)  
- Error handling and resilience
- Database connectivity through UI
- Performance and load testing
- Accessibility features

## 🗃️ Test Data Management

### Database Seeding

Integration tests use a seeded PostgreSQL database with real USCIS questions:

```bash
# Seed test database manually (usually automatic)
node test/seedTestDatabase.js seed

# Clear test database  
node test/seedTestDatabase.js clear

# Check seeding status
npm run test:integration -- --testNamePattern="should have all critical USCIS questions"
```

**Seeded Data Includes:**
- All 100 official USCIS civics questions
- Current officials (Donald Trump, J.D. Vance)
- Question categories and metadata
- Vector embeddings for semantic search
- Official answers for validation

### Test Data Sources

1. **Primary Source**: `data/processed-questions.json` (if available)
2. **Fallback**: Critical questions hardcoded in `seedTestDatabase.js`
3. **Categories**: Principles of Democracy, System of Government, History, Geography

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failures
```bash
# Symptoms: "Failed to connect to test database"
# Solutions:
docker ps | grep citizenship_postgres_test  # Check if running
docker logs citizenship_postgres_test       # Check container logs
npm run test:teardown && npm run test:setup # Restart database
```

#### 2. Missing API Key
```bash
# Symptoms: "OpenAI API key required"
# Solution: Add OPENAI_API_KEY to .env.test.local
echo 'OPENAI_API_KEY="sk-your-key"' >> .env.test.local
```

#### 3. Port Conflicts
```bash
# Symptoms: "Port 5434 already in use"
# Solutions:
lsof -ti:5434 | xargs kill    # Kill process using port
# OR change port in docker-compose.test.yml
```

#### 4. Seeding Failures  
```bash
# Symptoms: "total_documents: 0" in database tests
# Solutions:
node test/seedTestDatabase.js seed  # Manual seeding
# Check OPENAI_API_KEY is valid for embeddings
```

#### 5. Jest Configuration Issues
```bash
# Symptoms: ES module import errors
# Solution: Ensure babel is transforming correctly
npx babel-node --version  # Check babel installation
```

#### 6. Playwright Browser Issues
```bash
# Symptoms: Browser launch failures
# Solution: Reinstall browsers
npx playwright install
```

### Debug Commands

```bash
# Check test database status
docker exec -it citizenship_postgres_test psql -U citizenship_user -d citizenship_test_db -c "SELECT COUNT(*) FROM civics_questions;"

# Check API connectivity  
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"query":"constitution","limit":3}'

# Debug specific integration test
npx jest test/practiceQuestionFlow.integration.test.js --verbose

# Debug with real timers (for timer tests)
npx jest test/sessionManagement.integration.test.js --verbose --no-cache
```

### Performance Tuning

For faster test runs:

```bash
# Run only unit tests during development
npm run test:unit

# Run single integration test file
npx jest test/databaseIntegration.integration.test.js

# Skip E2E tests during development  
npm run test:unit && npm run test:integration

# Parallel test execution (Jest)
npx jest --maxWorkers=4  # Use 4 CPU cores
```

## 📊 Test Coverage and Reporting

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Playwright Reports
```bash
# View E2E test report
npx playwright show-report
```

### Test Results Summary
```bash
# Run all test types with summary
npm run test:unit && echo "✅ Unit tests passed" && \
npm run test:integration && echo "✅ Integration tests passed" && \
npm run test:e2e && echo "✅ E2E tests passed"
```

## 🎯 Best Practices

### Development Workflow
1. **Start with unit tests** for new business logic
2. **Use integration tests** for user journey validation  
3. **Add E2E tests** for critical user flows
4. **Run fast tests frequently**, slow tests before commits

### Test Data Management
- **Use real database** for integration tests
- **Keep test data isolated** from development data
- **Reset state** between test suites when needed
- **Use stable test data** (avoid random values in assertions)

### Performance Optimization
- **Run unit tests first** (fast feedback)
- **Use jest projects** to separate test types
- **Limit concurrent database tests** to avoid conflicts
- **Use test timeouts** appropriate for each test type

### Maintenance
- **Update test data** when USCIS questions change
- **Monitor test performance** and optimize slow tests
- **Review test failures** in CI/CD pipeline
- **Keep integration tests focused** on user value

## 🔄 CI/CD Integration

While not implemented yet, here's the recommended CI/CD approach:

```yaml
# GitHub Actions example
name: Test Suite
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: citizenship_pass
    steps:
      - uses: actions/checkout@v3  
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

This testing setup ensures **reliable, maintainable, and comprehensive** test coverage that matches your application's integration-focused architecture. 🚀