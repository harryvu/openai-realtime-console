import { pgTable, serial, text, vector, timestamp, integer, real } from "drizzle-orm/pg-core";

// USCIS Civics Questions table with vector embeddings
export const civicsQuestions = pgTable("civics_questions", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().unique(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-small dimensions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User profiles table for future authentication
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // External auth provider ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // 'google', 'facebook', 'microsoft'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User test progress tracking
export const testProgress = pgTable("test_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  questionId: integer("question_id").notNull(),
  correct: integer("correct").default(0), // Number of correct answers
  incorrect: integer("incorrect").default(0), // Number of incorrect answers
  lastAttempt: timestamp("last_attempt").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Search queries for analytics
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  userId: text("user_id"), // Optional, for authenticated users
  resultsCount: integer("results_count").notNull(),
  avgSimilarity: real("avg_similarity"), // Average similarity score
  timestamp: timestamp("timestamp").defaultNow(),
});