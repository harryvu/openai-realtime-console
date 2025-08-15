import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Chroma client with local persistence
const chroma = new ChromaClient({
  path: './chroma_data'
});

const COLLECTION_NAME = 'uscis_citizenship_questions';
const EMBEDDING_MODEL = 'text-embedding-3-small';

class VectorDatabase {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    try {
      console.log('🔌 Connecting to Chroma database...');
      
      // Try to get existing collection first
      try {
        this.collection = await chroma.getCollection({ name: COLLECTION_NAME });
        console.log('✅ Connected to existing collection');
      } catch (error) {
        // Collection doesn't exist, create it
        console.log('📦 Creating new collection...');
        this.collection = await chroma.createCollection({ 
          name: COLLECTION_NAME,
          metadata: { 
            description: 'USCIS Citizenship Test Questions and Answers',
            embedding_model: EMBEDDING_MODEL 
          },
          embeddingFunction: null // We'll provide embeddings manually
        });
        console.log('✅ Created new collection');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize vector database:', error);
      throw error;
    }
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

  async ingestDocuments(documents) {
    if (!this.collection) {
      throw new Error('Vector database not initialized');
    }

    console.log(`📥 Ingesting ${documents.length} documents...`);
    
    const ids = [];
    const embeddings = [];
    const metadatas = [];
    const documents_texts = [];

    for (const doc of documents) {
      try {
        console.log(`⚡ Processing question ${doc.id}...`);
        
        // Generate embedding for the content
        const embedding = await this.generateEmbedding(doc.content);
        
        ids.push(`question_${doc.id}`);
        embeddings.push(embedding);
        metadatas.push({
          question_id: doc.id,
          question: doc.question,
          answer: doc.answer,
          category: doc.category
        });
        documents_texts.push(doc.content);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to process question ${doc.id}:`, error);
        continue;
      }
    }

    try {
      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        metadatas: metadatas,
        documents: documents_texts
      });
      
      console.log(`✅ Successfully ingested ${ids.length} documents`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add documents to collection:', error);
      throw error;
    }
  }

  async search(query, nResults = 5) {
    if (!this.collection) {
      throw new Error('Vector database not initialized');
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search for similar documents
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: nResults,
        include: ['metadatas', 'documents', 'distances']
      });

      // Format results
      const formattedResults = [];
      if (results.metadatas && results.metadatas[0]) {
        for (let i = 0; i < results.metadatas[0].length; i++) {
          formattedResults.push({
            metadata: results.metadatas[0][i],
            document: results.documents[0][i],
            distance: results.distances[0][i],
            similarity: 1 - results.distances[0][i] // Convert distance to similarity
          });
        }
      }

      return formattedResults;
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    if (!this.collection) {
      throw new Error('Vector database not initialized');
    }

    try {
      const count = await this.collection.count();
      const info = {
        name: COLLECTION_NAME,
        count: count,
        embedding_model: EMBEDDING_MODEL
      };
      
      return info;
    } catch (error) {
      console.error('❌ Failed to get collection info:', error);
      throw error;
    }
  }

  async clearCollection() {
    if (!this.collection) {
      throw new Error('Vector database not initialized');
    }

    try {
      console.log('🗑️ Clearing collection...');
      
      // Delete the collection and recreate it
      await chroma.deleteCollection({ name: COLLECTION_NAME });
      this.collection = await chroma.createCollection({ 
        name: COLLECTION_NAME,
        metadata: { 
          description: 'USCIS Citizenship Test Questions and Answers',
          embedding_model: EMBEDDING_MODEL 
        },
        embeddingFunction: null // We'll provide embeddings manually
      });
      
      console.log('✅ Collection cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear collection:', error);
      throw error;
    }
  }
}

export { VectorDatabase };