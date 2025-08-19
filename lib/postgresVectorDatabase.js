import { db } from "./db/connection.js";
import { civicsQuestions, searchQueries } from "./db/schema.js";
import { sql, desc } from "drizzle-orm";
import OpenAI from "openai";

export class PostgresVectorDatabase {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: process.env.NODE_ENV === 'test', // Allow in test environment only
    });
    this.embedModel = "text-embedding-3-small";
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check if pg_vector extension is enabled
      const extensionCheck = await db.execute(
        sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      );
      
      if (extensionCheck.rowCount === 0) {
        console.log("⚠️ Installing pg_vector extension...");
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
        console.log("✅ pg_vector extension installed");
      }
      
      this.initialized = true;
      console.log("✅ PostgresVectorDatabase initialized");
      return this;
    } catch (error) {
      console.error("❌ Failed to initialize PostgresVectorDatabase:", error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embedModel,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  async ingestDocuments(documents) {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    console.log(`📊 Ingesting ${documents.length} documents...`);
    
    for (const doc of documents) {
      try {
        // Generate embedding for the question + answer text
        const textToEmbed = `${doc.question} ${doc.answer}`;
        const embedding = await this.generateEmbedding(textToEmbed);
        
        // Insert or update document using SQL to handle vector type
        // Convert embedding to proper vector string format
        const vectorStr = `[${embedding.join(',')}]`;
        
        await db.execute(
          sql`
            INSERT INTO civics_questions (question_id, question, answer, category, embedding)
            VALUES (${doc.id}, ${doc.question}, ${doc.answer}, ${doc.category}, ${vectorStr}::vector)
            ON CONFLICT (question_id)
            DO UPDATE SET
              question = EXCLUDED.question,
              answer = EXCLUDED.answer,
              category = EXCLUDED.category,
              embedding = EXCLUDED.embedding,
              updated_at = NOW()
          `
        );
        
        console.log(`✅ Ingested question ${doc.id}: ${doc.question.substring(0, 50)}...`);
      } catch (error) {
        console.error(`❌ Failed to ingest document ${doc.id}:`, error);
      }
    }
    
    console.log("✅ Document ingestion completed");
  }

  async search(query, nResults = 5, userId = null) {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingVector = `[${queryEmbedding.join(",")}]`;
      
      // Perform vector similarity search using cosine distance
      const results = await db.execute(
        sql`
          SELECT 
            id,
            question_id,
            question,
            answer,
            category,
            1 - (embedding <=> ${embeddingVector}::vector) as similarity
          FROM civics_questions
          ORDER BY embedding <=> ${embeddingVector}::vector
          LIMIT ${nResults}
        `
      );

      // Transform results to match SimpleVectorDatabase format
      const formattedResults = results.rows.map(row => ({
        document: {
          id: row.question_id,
          question: row.question,
          answer: row.answer,
          category: row.category,
        },
        metadata: {
          question_id: row.question_id,
          question: row.question,
          answer: row.answer,
          category: row.category,
        },
        similarity: parseFloat(row.similarity),
        distance: 1 - parseFloat(row.similarity),
      }));

      // Log search query for analytics
      try {
        await db.insert(searchQueries).values({
          query,
          userId,
          resultsCount: formattedResults.length,
          avgSimilarity: formattedResults.length > 0 
            ? formattedResults.reduce((sum, r) => sum + r.similarity, 0) / formattedResults.length 
            : 0,
        });
      } catch (logError) {
        console.warn("Failed to log search query:", logError);
      }

      return formattedResults;
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  }

  async getInfo() {
    if (!this.initialized) {
      return { error: "Database not initialized" };
    }

    try {
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM civics_questions`
      );
      
      const categoryResult = await db.execute(
        sql`
          SELECT category, COUNT(*) as count 
          FROM civics_questions 
          GROUP BY category 
          ORDER BY category
        `
      );

      const recentSearches = await db.execute(
        sql`
          SELECT query, results_count, avg_similarity, timestamp 
          FROM search_queries 
          ORDER BY timestamp DESC 
          LIMIT 5
        `
      );

      return {
        type: "PostgreSQL with pg_vector",
        totalDocuments: parseInt(countResult.rows[0].count),
        categories: categoryResult.rows.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {}),
        recentSearches: recentSearches.rows,
        embeddingModel: this.embedModel,
        embeddingDimensions: 1536,
        status: "ready",
      };
    } catch (error) {
      console.error("Failed to get database info:", error);
      return { error: "Failed to get database info" };
    }
  }

  // Get all documents (for migration purposes)
  async getAllDocuments() {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    try {
      const results = await db.select({
        id: civicsQuestions.questionId,
        question: civicsQuestions.question,
        answer: civicsQuestions.answer,
        category: civicsQuestions.category,
      }).from(civicsQuestions);

      return results;
    } catch (error) {
      console.error("Failed to get all documents:", error);
      throw error;
    }
  }

  async getRandomQuestion() {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    try {
      // Get a random question using SQL RANDOM()
      const results = await db.select({
        id: civicsQuestions.questionId,
        question: civicsQuestions.question,
        answer: civicsQuestions.answer,
        category: civicsQuestions.category,
      }).from(civicsQuestions)
        .orderBy(sql`RANDOM()`)
        .limit(1);

      if (results.length === 0) {
        throw new Error("No questions found in database");
      }

      return results[0];
    } catch (error) {
      console.error("Failed to get random question:", error);
      throw error;
    }
  }

  async getQuestionById(questionId) {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    try {
      const results = await db.select({
        id: civicsQuestions.questionId,
        question: civicsQuestions.question,
        answer: civicsQuestions.answer,
        category: civicsQuestions.category,
      }).from(civicsQuestions)
        .where(sql`${civicsQuestions.questionId} = ${questionId}`)
        .limit(1);

      if (results.length === 0) {
        throw new Error(`Question with id ${questionId} not found`);
      }

      return results[0];
    } catch (error) {
      console.error("Failed to get question by id:", error);
      throw error;
    }
  }

  async checkAnswer(questionId, userAnswer) {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    try {
      // Get the correct answer from database
      const question = await this.getQuestionById(questionId);
      const correctAnswer = question.answer.toLowerCase().trim();
      const providedAnswer = userAnswer.toLowerCase().trim();

      // Simple answer checking with common variations
      const isCorrect = correctAnswer.includes(providedAnswer) || 
                       providedAnswer.includes(correctAnswer) ||
                       correctAnswer === providedAnswer;

      return {
        correct: isCorrect,
        canonical_answer: question.answer,
        feedback: isCorrect ? "Correct!" : `The correct answer is: ${question.answer}`
      };
    } catch (error) {
      console.error("Failed to check answer:", error);
      throw error;
    }
  }

  // Check if database has data
  async hasData() {
    if (!this.initialized) {
      return false;
    }

    try {
      const result = await db.execute(
        sql`SELECT COUNT(*) as count FROM civics_questions`
      );
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error("Failed to check if database has data:", error);
      return false;
    }
  }
}