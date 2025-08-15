#!/usr/bin/env node

import { SimpleVectorDatabase } from "../lib/simpleVectorDatabase.js";
import { PostgresVectorDatabase } from "../lib/postgresVectorDatabase.js";
import { testConnection } from "../lib/db/connection.js";
import "dotenv/config";

async function migrateToPostgres() {
  console.log("🚀 Starting migration from JSON to PostgreSQL...\n");

  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.log("Please set DATABASE_URL in your .env file:");
    console.log("DATABASE_URL=postgresql://username:password@localhost:5432/citizenship_db");
    process.exit(1);
  }

  // Test PostgreSQL connection
  console.log("📡 Testing PostgreSQL connection...");
  const connected = await testConnection();
  if (!connected) {
    console.error("❌ Failed to connect to PostgreSQL. Please check your DATABASE_URL");
    process.exit(1);
  }

  try {
    // Initialize JSON database
    console.log("📖 Loading JSON vector database...");
    const jsonDB = new SimpleVectorDatabase();
    await jsonDB.initialize();
    
    const jsonInfo = jsonDB.getInfo();
    console.log(`   Found ${jsonInfo.count} documents in JSON database`);
    
    if (jsonInfo.count === 0) {
      console.log("⚠️ No documents found in JSON database. Run processDocuments.js first.");
      process.exit(0);
    }

    // Initialize PostgreSQL database
    console.log("🐘 Initializing PostgreSQL vector database...");
    const postgresDB = new PostgresVectorDatabase();
    await postgresDB.initialize();

    // Check if PostgreSQL already has data
    const hasData = await postgresDB.hasData();
    if (hasData) {
      console.log("⚠️ PostgreSQL database already contains data.");
      console.log("   Do you want to proceed? This will update existing records.");
      // For now, proceed anyway
    }

    // Get all documents from JSON database
    console.log("📦 Extracting documents from JSON database...");
    const documents = [];
    
    // Access the documents directly from JSON database
    for (let i = 0; i < jsonDB.documents.length; i++) {
      const doc = jsonDB.documents[i];
      if (doc && doc.metadata) {
        const meta = doc.metadata;
        if (meta.question_id && meta.question && meta.answer && meta.category) {
          documents.push({
            id: meta.question_id,
            question: meta.question,
            answer: meta.answer,
            category: meta.category,
          });
        }
      }
    }
    
    console.log(`   Extracted ${documents.length} documents`);

    // Migrate documents to PostgreSQL
    console.log("🔄 Migrating documents to PostgreSQL...");
    await postgresDB.ingestDocuments(documents);

    // Verify migration
    console.log("✅ Verifying migration...");
    const postgresInfo = await postgresDB.getInfo();
    console.log(`   PostgreSQL database now contains ${postgresInfo.totalDocuments} documents`);
    console.log(`   Categories: ${JSON.stringify(postgresInfo.categories, null, 2)}`);

    // Test search functionality
    console.log("🔍 Testing search functionality...");
    const testQueries = [
      "Who is the current president?",
      "What is the Constitution?",
      "Name one branch of government"
    ];

    for (const query of testQueries) {
      console.log(`   Testing: "${query}"`);
      const results = await postgresDB.search(query, 2);
      console.log(`   Found ${results.length} results, top similarity: ${results[0]?.similarity.toFixed(3)}`);
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("📋 Next steps:");
    console.log("   1. Update your .env file with DATABASE_URL");
    console.log("   2. Update server.js to use PostgresVectorDatabase");
    console.log("   3. Test the application");
    console.log("   4. Optional: Remove the old JSON vector database file");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateToPostgres().catch(console.error);