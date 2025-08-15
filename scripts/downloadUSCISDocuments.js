import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_DIR = './data';
const USCIS_DOCUMENTS = [
  {
    url: 'https://www.uscis.gov/sites/default/files/document/questions-and-answers/100q.pdf',
    filename: '100-civics-questions.pdf',
    description: 'Official 100 Civics Questions and Answers'
  }
];

async function downloadUSCISDocuments() {
  console.log('📥 Downloading USCIS documents...');
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  for (const doc of USCIS_DOCUMENTS) {
    const filePath = path.join(DATA_DIR, doc.filename);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${doc.filename} already exists, skipping download`);
      continue;
    }

    try {
      console.log(`📄 Downloading ${doc.description}...`);
      const response = await axios({
        url: doc.url,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`✅ Downloaded ${doc.filename}`);
    } catch (error) {
      console.error(`❌ Failed to download ${doc.filename}:`, error.message);
    }
  }

  console.log('🎉 USCIS document download complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadUSCISDocuments().catch(console.error);
}

export { downloadUSCISDocuments };