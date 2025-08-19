import { 
  formatContextFromResults, 
  isCitizenshipRelated, 
  isCurrentOfficialsQuery, 
  prepareEnhancedMessage,
  extractUserMessage 
} from '../lib/ragUtils.js';

describe('RAG Utils - Pure Business Logic', () => {
  describe('formatContextFromResults', () => {
    it('returns null for empty results', () => {
      expect(formatContextFromResults([], 'test query')).toBe(null);
      expect(formatContextFromResults(null, 'test query')).toBe(null);
    });

    it('formats single result correctly', () => {
      const results = [{
        metadata: {
          question_id: 1,
          question: 'What is the supreme law of the land?',
          answer: 'the Constitution'
        }
      }];
      
      const formatted = formatContextFromResults(results, 'constitution');
      
      expect(formatted).toContain('Here are the official USCIS answers');
      expect(formatted).toContain('OFFICIAL QUESTION 1: What is the supreme law of the land?');
      expect(formatted).toContain('OFFICIAL ANSWER: the Constitution');
    });

    it('formats multiple results correctly', () => {
      const results = [
        {
          metadata: {
            question_id: 1,
            question: 'What is the supreme law of the land?',
            answer: 'the Constitution'
          }
        },
        {
          metadata: {
            question_id: 28,
            question: 'What is the name of the President of the United States now?',
            answer: 'Donald Trump'
          }
        }
      ];
      
      const formatted = formatContextFromResults(results, 'president');
      
      expect(formatted).toContain('OFFICIAL QUESTION 1:');
      expect(formatted).toContain('OFFICIAL QUESTION 28:');
      expect(formatted).toContain('Donald Trump');
    });
  });

  describe('isCitizenshipRelated', () => {
    it('identifies citizenship-related English queries', () => {
      expect(isCitizenshipRelated('What is the Constitution?')).toBe(true);
      expect(isCitizenshipRelated('Who is the president?')).toBe(true);
      expect(isCitizenshipRelated('Tell me about Congress')).toBe(true);
      expect(isCitizenshipRelated('American history question')).toBe(true);
      expect(isCitizenshipRelated('naturalization process')).toBe(true);
    });

    it('identifies citizenship-related Vietnamese queries', () => {
      expect(isCitizenshipRelated('Hiến pháp là gì?')).toBe(true);
      expect(isCitizenshipRelated('Tổng thống hiện tại là ai?')).toBe(true);
      expect(isCitizenshipRelated('Về quốc hội Mỹ')).toBe(true);
    });

    it('allows non-Latin character queries (multilingual support)', () => {
      expect(isCitizenshipRelated('中国人可以入籍吗')).toBe(true);
      expect(isCitizenshipRelated('الجنسية الأمريكية')).toBe(true);
    });

    it('rejects clearly unrelated queries', () => {
      expect(isCitizenshipRelated('What is the weather today?')).toBe(false);
      expect(isCitizenshipRelated('How to cook pasta?')).toBe(false);
      expect(isCitizenshipRelated('Programming in JavaScript')).toBe(false);
    });
  });

  describe('isCurrentOfficialsQuery', () => {
    it('identifies current president queries', () => {
      expect(isCurrentOfficialsQuery('Who is the current president?')).toBe(true);
      expect(isCurrentOfficialsQuery('current president of USA')).toBe(true);
      expect(isCurrentOfficialsQuery('president now')).toBe(true);
      expect(isCurrentOfficialsQuery('Trump')).toBe(true);
    });

    it('identifies current vice president queries', () => {
      expect(isCurrentOfficialsQuery('Who is the vice president now?')).toBe(true);
      expect(isCurrentOfficialsQuery('current vice president')).toBe(true);
      expect(isCurrentOfficialsQuery('Vance')).toBe(true);
    });

    it('identifies current governor queries', () => {
      expect(isCurrentOfficialsQuery('Who is the current governor?')).toBe(true);
      expect(isCurrentOfficialsQuery('Newsom')).toBe(true);
    });

    it('rejects non-official queries', () => {
      expect(isCurrentOfficialsQuery('What is the Constitution?')).toBe(false);
      expect(isCurrentOfficialsQuery('History of America')).toBe(false);
    });
  });

  describe('prepareEnhancedMessage', () => {
    it('returns original message when no search results', () => {
      const result = prepareEnhancedMessage('test question', []);
      
      expect(result.message).toBe('test question');
      expect(result.hasContext).toBe(false);
    });

    it('enhances message with search results context', () => {
      const searchResults = [{
        metadata: {
          question_id: 1,
          question: 'What is the supreme law of the land?',
          answer: 'the Constitution'
        }
      }];
      
      const result = prepareEnhancedMessage('constitution question', searchResults);
      
      expect(result.hasContext).toBe(true);
      expect(result.contextSize).toBe(1);
      expect(result.message).toContain('Here are the official USCIS answers');
      expect(result.message).toContain('User question: constitution question');
      expect(result.message).toContain('OFFICIAL ANSWER: the Constitution');
    });
  });

  describe('extractUserMessage', () => {
    it('extracts user message from enhanced message', () => {
      const enhancedMessage = `Here are the official USCIS answers for your question about "test":

OFFICIAL QUESTION 1: What is the supreme law of the land?
OFFICIAL ANSWER: the Constitution

User question: What is the Constitution?`;
      
      const extracted = extractUserMessage(enhancedMessage);
      expect(extracted).toBe('What is the Constitution?');
    });

    it('returns original message if no user question pattern found', () => {
      const simpleMessage = 'Just a simple question';
      const extracted = extractUserMessage(simpleMessage);
      expect(extracted).toBe('Just a simple question');
    });
  });
});