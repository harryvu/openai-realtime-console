// Utility functions for RAG (Retrieval Augmented Generation)

/**
 * Format search results into context for the LLM
 */
export function formatContextFromResults(searchResults, query) {
  if (!searchResults || searchResults.length === 0) {
    return null;
  }

  const contextParts = [
    `Here are the official USCIS answers for your question about "${query}":`
  ];

  searchResults.forEach((result, index) => {
    const { metadata } = result;
    contextParts.push(
      ``,
      `OFFICIAL QUESTION ${metadata.question_id}: ${metadata.question}`,
      `OFFICIAL ANSWER: ${metadata.answer}`
    );
  });

  return contextParts.join('\n');
}

/**
 * Check if a query seems to be citizenship-related
 * Note: For non-English queries, we'll be more permissive and let the AI decide
 */
export function isCitizenshipRelated(query) {
  const citizenshipKeywords = [
    'constitution', 'government', 'president', 'congress', 'senate', 'house', 
    'amendment', 'bill of rights', 'declaration', 'independence', 'history',
    'citizenship', 'naturalization', 'civics', 'america', 'united states',
    'democracy', 'republic', 'federal', 'state', 'law', 'rights', 'freedom',
    'war', 'colony', 'founding', 'capital', 'flag', 'anthem', 'holiday',
    'vice president', 'governor', 'trump', 'vance', 'newsom',
    // Vietnamese keywords
    'hiến pháp', 'chính phủ', 'tổng thống', 'quốc hội', 'thượng viện', 'hạ viện',
    'tu chính', 'tuyên ngôn', 'độc lập', 'lịch sử', 'công dân', 'nhập tịch',
    'dân chủ', 'cộng hòa', 'liên bang', 'bang', 'luật', 'quyền', 'tự do'
  ];

  const lowerQuery = query.toLowerCase();
  const hasEnglishKeywords = citizenshipKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // If it contains English keywords, check normally
  if (hasEnglishKeywords) {
    return true;
  }
  
  // For queries without English keywords (potentially other languages), 
  // be more permissive and let the AI decide
  const hasNonLatinCharacters = /[^\u0000-\u007F]/.test(query);
  if (hasNonLatinCharacters) {
    return true; // Assume non-English queries are potentially citizenship-related
  }
  
  return hasEnglishKeywords;
}

/**
 * Check if query is specifically about current officials
 */
export function isCurrentOfficialsQuery(query) {
  const currentOfficialKeywords = [
    'current president', 'who is president', 'president now', 'trump',
    'current vice president', 'who is vice president', 'vice president now', 'vance',
    'current governor', 'who is governor', 'governor now', 'newsom',
    'who is the president', 'who is the vice president', 'who is the governor'
  ];
  
  const lowerQuery = query.toLowerCase();
  return currentOfficialKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Prepare an enhanced prompt with context
 */
export function prepareEnhancedMessage(userMessage, searchResults) {
  const context = formatContextFromResults(searchResults, userMessage);
  
  if (!context) {
    return {
      message: userMessage,
      hasContext: false
    };
  }

  return {
    message: `${context}

User question: ${userMessage}`,
    hasContext: true,
    contextSize: searchResults.length
  };
}

/**
 * Extract the actual user message from an enhanced message
 */
export function extractUserMessage(enhancedMessage) {
  const userQuestionMatch = enhancedMessage.match(/User [Qq]uestion: (.+)$/);
  return userQuestionMatch ? userQuestionMatch[1] : enhancedMessage;
}