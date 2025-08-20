
import { render, screen, waitFor, act } from '@testing-library/react';
import CitizenshipTestPanel from '../client/components/CitizenshipTestPanel.jsx';

// Test for new practice questions after resume
describe('New Practice Questions After Resume', () => {
  const defaultProps = {
    isSessionActive: true,
    sendClientEvent: jest.fn(),
    events: [],
    sendTextMessage: jest.fn(),
    isPaused: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fetch for database operations
    global.fetch = jest.fn((url, options) => {
      if (url === '/search' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        const query = body.query;
        
        // Return different results based on the query
        if (query.includes('supreme law')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [{
                metadata: {
                  question: 'What is the supreme law of the land?',
                  answer: 'the Constitution',
                  category: 'Principles of Democracy',
                  question_id: 1
                },
                similarity: 0.95
              }]
            })
          });
        } else if (query.includes('amendments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [{
                metadata: {
                  question: 'What do we call the first ten amendments to the Constitution?',
                  answer: 'the Bill of Rights',
                  category: 'System of Government',
                  question_id: 5
                },
                similarity: 0.95
              }]
            })
          });
        }
      }
      
      if (url === '/search/info') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            count: 100,
            embedding_model: 'text-embedding-3-small'
          })
        });
      }
      
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('should update sidebar when new practice question is asked after resume', async () => {
    // Step 1: Start with first practice question
    const firstQuestionEvents = [
      {
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call',
            name: 'request_practice_question',
            arguments: JSON.stringify({
              question: 'What is the supreme law of the land?'
            })
          }]
        }
      },
      { type: 'session.created' }
    ];

    const { rerender } = render(
      <CitizenshipTestPanel 
        {...defaultProps} 
        events={firstQuestionEvents} 
        isPaused={false} 
      />
    );

    // Wait for first question to appear
    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
      expect(screen.getByText('Question #1')).toBeInTheDocument();
    });

    console.log('✅ First question displayed');

    // Step 2: Simulate pause
    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={firstQuestionEvents} 
          isPaused={true} 
        />
      );
    });

    // Step 3: Simulate resume (same events preserved)
    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={firstQuestionEvents} 
          isPaused={false} 
        />
      );
    });

    // First question should still be visible after resume
    expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
    console.log('✅ First question preserved after resume');

    // Step 4: NEW practice question requested after resume
    // Structure like real app: newest events first
    const secondQuestionEvents = [
      {
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call',
            name: 'request_practice_question',
            arguments: JSON.stringify({
              question: 'What do we call the first ten amendments to the Constitution?'
            })
          }]
        }
      },
      ...firstQuestionEvents // Old events after new ones
    ];

    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={secondQuestionEvents} 
          isPaused={false} 
        />
      );
    });

    // Step 5: CRITICAL TEST - Sidebar should update to show NEW question
    await waitFor(() => {
      // The NEW question should be displayed
      expect(screen.getByText('What do we call the first ten amendments to the Constitution?')).toBeInTheDocument();
      expect(screen.getByText('Question #5')).toBeInTheDocument();
      expect(screen.getByText('System of Government')).toBeInTheDocument();
    }, { timeout: 3000 });

    // The OLD question should no longer be displayed
    expect(screen.queryByText('What is the supreme law of the land?')).not.toBeInTheDocument();
    expect(screen.queryByText('Principles of Democracy')).not.toBeInTheDocument();

    console.log('✅ Sidebar updated to show new question after resume');
  });

  it('should demonstrate the BUG: new question after resume does not update sidebar', async () => {
    // This test documents the current broken behavior
    const firstQuestionEvents = [
      {
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call',
            name: 'request_practice_question',
            arguments: JSON.stringify({
              question: 'What is the supreme law of the land?'
            })
          }]
        }
      },
      { type: 'session.created' }
    ];

    const { rerender } = render(
      <CitizenshipTestPanel 
        {...defaultProps} 
        events={firstQuestionEvents} 
        isPaused={false} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
    });

    // Pause and resume
    rerender(<CitizenshipTestPanel {...defaultProps} events={firstQuestionEvents} isPaused={true} />);
    await act(async () => {
      rerender(<CitizenshipTestPanel {...defaultProps} events={firstQuestionEvents} isPaused={false} />);
    });

    // New question after resume - structured like real app (newest first)
    const secondQuestionEvents = [
      {
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call',
            name: 'request_practice_question',
            arguments: JSON.stringify({
              question: 'What do we call the first ten amendments to the Constitution?'
            })
          }]
        }
      },
      ...firstQuestionEvents
    ];

    await act(async () => {
      rerender(<CitizenshipTestPanel {...defaultProps} events={secondQuestionEvents} isPaused={false} />);
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Document current behavior
    console.log('=== CURRENT BEHAVIOR DEBUG ===');
    const newQuestion = screen.queryByText('What do we call the first ten amendments to the Constitution?');
    const oldQuestion = screen.queryByText('What is the supreme law of the land?');
    
    if (newQuestion) {
      console.log('✅ New question is displayed (GOOD)');
    } else {
      console.log('❌ New question is NOT displayed (BUG)');
    }
    
    if (oldQuestion) {
      console.log('⚠️  Old question is still displayed (POTENTIALLY BAD)');
    } else {
      console.log('✅ Old question is gone (GOOD)');
    }

    console.log('Current HTML:', document.body.innerHTML.substring(0, 1000));
  });
});