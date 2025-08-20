#!/bin/sh

# Docker entrypoint script for US Citizenship Test Assistant
# Handles database migration and application startup

set -e

echo "🚀 Starting US Citizenship Test Assistant container..."

# Check if we're in Azure App Service (has specific environment variables)
if [ -n "$WEBSITE_SITE_NAME" ]; then
    echo "🔵 Running in Azure App Service: $WEBSITE_SITE_NAME"
fi

# Wait for database to be ready if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
    echo "🐘 Waiting for PostgreSQL database to be ready..."
    
    # Extract host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -z "$DB_PORT" ]; then
        DB_PORT=5432
    fi
    
    echo "🔍 Checking database connectivity to $DB_HOST:$DB_PORT..."
    
    # Simple connectivity check using nc (netcat)
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "✅ Database is ready after $attempt attempts"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            echo "❌ Database connection failed after $max_attempts attempts"
            echo "🔍 DATABASE_URL: ${DATABASE_URL%@*}@[REDACTED]"
            exit 1
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts: Database not ready, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
else
    echo "⚠️  No DATABASE_URL provided, skipping database checks"
fi

# Run database migrations if in production
if [ "$NODE_ENV" = "production" ] && [ -n "$DATABASE_URL" ]; then
    echo "🔄 Running database migrations..."
    if npm run db:migrate; then
        echo "✅ Database migrations completed successfully"
    else
        echo "❌ Database migrations failed"
        exit 1
    fi
fi

# Set default NODE_ENV if not provided
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
    echo "🔧 NODE_ENV not set, defaulting to production"
fi

echo "🌍 NODE_ENV: $NODE_ENV"
echo "🔑 OpenAI API Key: ${OPENAI_API_KEY:+[SET]}${OPENAI_API_KEY:-[NOT SET]}"
echo "🗄️  Database: ${DATABASE_URL:+[SET]}${DATABASE_URL:-[NOT SET]}"

# Health check endpoint setup
echo "🏥 Health check endpoint will be available at /health"

# Start the application
echo "🎯 Starting application with command: $@"
exec "$@"