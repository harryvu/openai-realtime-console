import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DATABASE_FILE = './data/vector_database.json';

class SimpleVectorDatabase {
  constructor() {
    this.documents = [];
    this.embeddings = [];
  }

  async initialize() {
    console.log('🔌 Initializing simple vector database...');
    
    // Load existing database if it exists
    if (fs.existsSync(DATABASE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf8'));
        this.documents = data.documents || [];
        this.embeddings = data.embeddings || [];
        console.log(`✅ Loaded ${this.documents.length} documents from cache`);
      } catch (error) {
        console.log('⚠️ Failed to load cached data, starting fresh');
        this.documents = [];
        this.embeddings = [];
      }
    }
    
    return true;
  }

  async generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async ingestDocuments(documents) {
    console.log(`📥 Ingesting ${documents.length} documents...`);
    
    // Clear existing data
    this.documents = [];
    this.embeddings = [];
    
    for (const doc of documents) {
      try {
        console.log(`⚡ Processing question ${doc.id}...`);
        
        // Generate embedding for the content
        const embedding = await this.generateEmbedding(doc.content);
        
        this.documents.push({
          id: `question_${doc.id}`,
          metadata: {
            question_id: doc.id,
            question: doc.question,
            answer: doc.answer,
            category: doc.category
          },
          content: doc.content
        });
        
        this.embeddings.push(embedding);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Failed to process question ${doc.id}:`, error);
        continue;
      }
    }

    // Save to disk
    await this.save();
    
    console.log(`✅ Successfully ingested ${this.documents.length} documents`);
    return true;
  }

  async search(query, nResults = 5) {
    if (this.documents.length === 0) {
      throw new Error('No documents in database');
    }

    try {
      console.log(`🔍 Searching for: "${query}"`);
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarities
      const results = [];
      for (let i = 0; i < this.documents.length; i++) {
        const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
        results.push({
          document: this.documents[i],
          similarity: similarity,
          distance: 1 - similarity
        });
      }
      
      // Sort by similarity (highest first) and return top N
      results.sort((a, b) => b.similarity - a.similarity);
      
      return results.slice(0, nResults).map(result => ({
        metadata: result.document.metadata,
        document: result.document.content,
        similarity: result.similarity,
        distance: result.distance
      }));
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  async save() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DATABASE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const data = {
        documents: this.documents,
        embeddings: this.embeddings,
        metadata: {
          model: EMBEDDING_MODEL,
          count: this.documents.length,
          created: new Date().toISOString()
        }
      };
      
      fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 2));
      console.log(`💾 Saved database to ${DATABASE_FILE}`);
    } catch (error) {
      console.error('❌ Failed to save database:', error);
      throw error;
    }
  }

  getInfo() {
    return {
      count: this.documents.length,
      embedding_model: EMBEDDING_MODEL,
      database_file: DATABASE_FILE
    };
  }

  clear() {
    this.documents = [];
    this.embeddings = [];
    
    // Remove saved file
    if (fs.existsSync(DATABASE_FILE)) {
      fs.unlinkSync(DATABASE_FILE);
    }
    
    console.log('✅ Database cleared');
  }
}

export { SimpleVectorDatabase };