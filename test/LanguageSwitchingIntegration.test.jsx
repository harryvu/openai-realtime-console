/**
 * Integration test for language switching and sidebar update scenarios
 * Tests the critical edge case where AI speaks Vietnamese questions but sidebar
 * shows English questions, and ensures proper updates happen.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import CitizenshipTestPanel from '../client/components/CitizenshipTestPanel.jsx';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Language Switching Integration Tests', () => {
  let mockSendClientEvent;
  let mockSendTextMessage;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSendClientEvent = jest.fn();
    mockSendTextMessage = jest.fn();
    
    // Setup default fetch responses
    global.fetch.mockImplementation((url, options) => {
      if (url === '/search/info') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalDocuments: 100,
            status: 'ready'
          })
        });
      }
      
      if (url === '/search' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        
        // Mock Vietnamese question search results
        if (body.query.includes('bao nhiêu thượng nghị sĩ')) {
          // Vietnamese "How many senators" should find English equivalent
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [{
                metadata: {
                  question_id: 18,
                  question: 'How many U.S. Senators are there?',
                  answer: 'one hundred (100)',
                  category: 'System of Government'
                },
                similarity: 0.85
              }]
            })
          });
        }
        
        if (body.query.includes('Cabinet-level positions')) {
          // English Cabinet question
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [{
                metadata: {
                  question_id: 36,
                  question: 'What are two Cabinet-level positions?',
                  answer: 'Secretary of Agriculture, Secretary of Commerce, Secretary of Defense...',
                  category: 'System of Government'
                },
                similarity: 0.95
              }]
            })
          });
        }
        
        // Default response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] })
        });
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  test('should handle language switching from English to Vietnamese correctly', async () => {
    const { rerender } = render(
      <CitizenshipTestPanel
        isSessionActive={true}
        sendClientEvent={mockSendClientEvent}
        events={[]}
        sendTextMessage={mockSendTextMessage}
        isPaused={false}
      />
    );

    // Step 1: AI asks English question (Cabinet positions)
    const englishQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'What are two Cabinet-level positions?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[englishQuestionEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify English question appears in sidebar
    await waitFor(() => {
      expect(screen.getByText('What are two Cabinet-level positions?')).toBeInTheDocument();
      expect(screen.getByText('Question #36')).toBeInTheDocument();
    });

    console.log('✅ Step 1: English question displayed correctly');

    // Step 2: AI asks Vietnamese question (senators)
    const vietnameseQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'Hoa Kỳ có bao nhiêu thượng nghị sĩ?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[englishQuestionEvent, vietnameseQuestionEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify sidebar updates to show the English equivalent of Vietnamese question
    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
      expect(screen.getByText('Question #18')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify old English question is no longer displayed
    await waitFor(() => {
      expect(screen.queryByText('What are two Cabinet-level positions?')).not.toBeInTheDocument();
      expect(screen.queryByText('Question #36')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('✅ Step 2: Vietnamese question correctly mapped to English equivalent');

    // Verify the correct search was performed
    expect(global.fetch).toHaveBeenCalledWith('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Hoa Kỳ có bao nhiêu thượng nghị sĩ?',
        limit: 1
      })
    });
  });

  test('should handle consecutive Vietnamese questions correctly', async () => {
    const { rerender } = render(
      <CitizenshipTestPanel
        isSessionActive={true}
        sendClientEvent={mockSendClientEvent}
        events={[]}
        sendTextMessage={mockSendTextMessage}
        isPaused={false}
      />
    );

    // First Vietnamese question
    const firstVietnameseEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'Hoa Kỳ có bao nhiêu thượng nghị sĩ?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[firstVietnameseEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
    });

    // Second Vietnamese question (different)
    global.fetch.mockImplementation((url, options) => {
      if (url === '/search/info') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ totalDocuments: 100, status: 'ready' })
        });
      }
      
      if (url === '/search' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        
        if (body.query.includes('Tổng thống')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [{
                metadata: {
                  question_id: 28,
                  question: 'What is the name of the President of the United States now?',
                  answer: 'Donald Trump',
                  category: 'System of Government'
                },
                similarity: 0.85
              }]
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] })
        });
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    const secondVietnameseEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'Ai là Tổng thống Hoa Kỳ hiện nay?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[firstVietnameseEvent, secondVietnameseEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify sidebar updates to new question
    await waitFor(() => {
      expect(screen.getByText('What is the name of the President of the United States now?')).toBeInTheDocument();
      expect(screen.getByText('Question #28')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify old question is gone
    await waitFor(() => {
      expect(screen.queryByText('How many U.S. Senators are there?')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('✅ Consecutive Vietnamese questions handled correctly');
  });

  test('should handle sidebar mismatch detection and correction', async () => {
    // Start with a component that has a pre-existing English question
    const { rerender } = render(
      <CitizenshipTestPanel
        isSessionActive={true}
        sendClientEvent={mockSendClientEvent}
        events={[{
          type: 'response.done',
          response: {
            output: [{
              type: 'function_call',
              name: 'request_practice_question',
              arguments: JSON.stringify({
                question: 'What are two Cabinet-level positions?'
              })
            }]
          }
        }]}
        sendTextMessage={mockSendTextMessage}
        isPaused={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('What are two Cabinet-level positions?')).toBeInTheDocument();
    });

    // Now AI speaks the same Vietnamese question twice (edge case)
    // but the sidebar should still update if there's a mismatch
    const vietnameseQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'Hoa Kỳ có bao nhiêu thượng nghị sĩ?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[vietnameseQuestionEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify the sidebar updates despite potential comparison issues
    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(screen.queryByText('What are two Cabinet-level positions?')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('✅ Sidebar mismatch detection and correction working');
  });

  test('should preserve question state during pause/resume with language switch', async () => {
    const { rerender } = render(
      <CitizenshipTestPanel
        isSessionActive={true}
        sendClientEvent={mockSendClientEvent}
        events={[]}
        sendTextMessage={mockSendTextMessage}
        isPaused={false}
      />
    );

    // Display Vietnamese question
    const vietnameseEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'Hoa Kỳ có bao nhiêu thượng nghị sĩ?'
          })
        }]
      }
    };

    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[vietnameseEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for async effects and state updates
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
    });

    // Pause session
    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={false}
          sendClientEvent={mockSendClientEvent}
          events={[vietnameseEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={true}
        />
      );
      // Allow time for state updates
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Question should still be visible during pause
    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
    });

    // Resume session
    await act(async () => {
      rerender(
        <CitizenshipTestPanel
          isSessionActive={true}
          sendClientEvent={mockSendClientEvent}
          events={[vietnameseEvent]}
          sendTextMessage={mockSendTextMessage}
          isPaused={false}
        />
      );
      // Allow time for state updates
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Question should still be preserved after resume
    await waitFor(() => {
      expect(screen.getByText('How many U.S. Senators are there?')).toBeInTheDocument();
    });

    console.log('✅ Question state preserved during pause/resume with language switch');
  });
});