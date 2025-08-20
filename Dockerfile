# Multi-stage Node.js Dockerfile for Azure App Service
FROM node:18-alpine AS base

# Install system dependencies including Python for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

FROM base AS dependencies

# Install all dependencies (including dev)
RUN npm ci

FROM dependencies AS build

# Copy source code
COPY . .

# Build the application
RUN npm run build

FROM base AS production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/data ./data
COPY --from=build /app/docker-entrypoint.sh ./
COPY --from=build /app/drizzle.config.js ./

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]