import { useEffect, useState, useRef, useCallback } from "react";
import { BookOpen, Award, Search } from "react-feather";

const functionDescription = `
SILENT FUNCTION: Call this function AFTER you speak a practice question to the user, but NEVER mention or announce that you're calling it.
Simply provide the exact question text you just spoke so it can be displayed in the sidebar and matched to the database for the correct answer.
The user should never know this function exists - it works behind the scenes to populate the sidebar.
`;

const currentOfficialsDescription = `
Call this function when a user asks about current government officials like the President, Vice President, or governors.
`;

const _sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "provide_current_official_info",
        description: currentOfficialsDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            position: {
              type: "string",
              description: "The government position (President, Vice President, Governor, etc.)",
            },
            name: {
              type: "string",
              description: "The current office holder's name",
            },
            question_number: {
              type: "number",
              description: "The USCIS question number related to this position",
            },
            additional_info: {
              type: "string",
              description: "Any additional relevant information about the position or powers",
            }
          },
          required: ["position", "name", "question_number"],
        },
      },
      {
        type: "function",
        name: "request_practice_question",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            question: {
              type: "string",
              description: "The exact question you just spoke to the user",
            },
            category: {
              type: "string",
              description: "Optional category (System of Government, Principles of Democracy, History, Geography, etc.)",
            }
          },
          required: ["question"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function CurrentOfficialOutput({ functionCallOutput }) {
  const { position, name, question_number, additional_info } = JSON.parse(functionCallOutput.arguments);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="text-blue-600" size={16} />
          <span className="text-sm font-medium text-blue-800">USCIS Question #{question_number}</span>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">Current Official</span>
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">{position}: {name}</h3>
        {additional_info && (
          <div className="text-sm text-gray-700">
            {additional_info}
          </div>
        )}
      </div>
    </div>
  );
}

// Extract answer from RAG-enhanced context
function extractAnswerFromContext(enhancedMessage, originalQuestion) {
  console.log('Extracting answer from enhanced message:', enhancedMessage);
  
  // The enhanced message contains context from the vector database
  // Look for patterns that indicate an answer
  const answerPatterns = [
    /OFFICIAL ANSWER[:\s]+(.*?)(?=\n|$)/i,
    /Answer[:\s]+(.*?)(?=\n|$)/i,
    /Official answer[:\s]+(.*?)(?=\n|$)/i,
    // Look for text after the question
    new RegExp(`${originalQuestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*(?:Answer[:\\s]*)?([^\\n]+)`, 'i')
  ];
  
  for (const pattern of answerPatterns) {
    const match = enhancedMessage.match(pattern);
    if (match && match[1]) {
      let answer = match[1].trim();
      // Clean up the answer
      answer = answer.replace(/^[:\-\s]+/, ''); // Remove leading colons, dashes, spaces
      answer = answer.replace(/\s+/g, ' '); // Normalize whitespace
      if (answer.length > 10) { // Ensure we have a substantial answer
        console.log('Extracted answer:', answer);
        return answer;
      }
    }
  }
  
  // If no pattern matches, try to find any substantial text that might be the answer
  const lines = enhancedMessage.split('\n');
  for (const line of lines) {
    if (line.includes('Answer') || line.includes('answer')) {
      const parts = line.split(/[:"-]/);
      if (parts.length > 1) {
        const possibleAnswer = parts[parts.length - 1].trim();
        if (possibleAnswer.length > 10) {
          console.log('Found answer in line:', possibleAnswer);
          return possibleAnswer;
        }
      }
    }
  }
  
  console.log('Could not extract answer from context');
  return null;
}

// Fallback answers for common questions when database search fails
function getFallbackAnswer(questionNumber, questionText) {
  const fallbacks = {
    1: "the Constitution",
    2: "sets up the government, defines the government, protects basic rights of Americans", 
    3: "We the People",
    4: "a change to the Constitution, an addition to the Constitution",
    5: "the Bill of Rights",
    6: "speech, religion, assembly, press, petition the government",
    18: "one hundred (100)",
    28: "Donald Trump",
    29: "J.D. Vance", 
    47: "Mike Johnson",
    49: "serve on a jury, vote in a federal election",
    63: "He freed the slaves (Emancipation Proclamation). He saved (or preserved) the Union. He led the United States during the Civil War.",
  };
  
  // Try to match by question text if number doesn't work
  if (!fallbacks[questionNumber]) {
    if (questionText.includes("how many.*senator")) {
      return "one hundred (100)";
    }
    if (questionText.includes("Speaker of the House")) {
      return "Mike Johnson";
    }
    if (questionText.includes("President.*now")) {
      return "Donald Trump";
    }
    if (questionText.includes("Vice President.*now")) {
      return "J.D. Vance";
    }
  }
  
  return fallbacks[questionNumber] || `Answer not available for question ${questionNumber}. Please try another question or check the official USCIS materials.`;
}

function PracticeQuestionOutput({ functionCallOutput, sendTextMessage, onUserActivity }) {
  const { category, question, question_number } = JSON.parse(functionCallOutput.arguments);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [loadingAnswer, setLoadingAnswer] = useState(false);

  // Reset answer visibility when a new question loads
  useEffect(() => {
    setShowAnswer(false);
    setAnswer(null);
  }, [functionCallOutput]);

  const handleShowAnswer = async () => {
    if (!answer && !loadingAnswer) {
      setLoadingAnswer(true);
      try {
        console.log(`Fetching answer for Q${question_number}: "${question}"`);
        
        // First try direct question search by text (more reliable than RAG for exact matches)
        let response = await fetch('/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: question,
            limit: 1
          })
        });
        
        let data = await response.json();
        console.log('Direct search results:', data);
        
        if (data.results && data.results.length > 0 && data.results[0].similarity > 0.8) {
          // High similarity match found
          const directAnswer = data.results[0].metadata.answer;
          console.log('Found direct answer:', directAnswer);
          setAnswer(directAnswer);
        } else {
          // Fallback to RAG system
          console.log('Using RAG system as fallback');
          response = await fetch('/enhance-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: question
            })
          });
          
          const enhancementData = await response.json();
          console.log('RAG enhancement data:', enhancementData);
          
          if (enhancementData.hasContext && enhancementData.enhancedMessage) {
            const extractedAnswer = extractAnswerFromContext(enhancementData.enhancedMessage, question);
            if (extractedAnswer) {
              setAnswer(extractedAnswer);
            } else {
              const fallbackAnswer = getFallbackAnswer(question_number, question);
              setAnswer(fallbackAnswer);
            }
          } else {
            console.log('No context from RAG system, using fallback');
            const fallbackAnswer = getFallbackAnswer(question_number, question);
            setAnswer(fallbackAnswer);
          }
        }
      } catch (error) {
        console.error('Error fetching answer:', error);
        const fallbackAnswer = getFallbackAnswer(question_number, question);
        setAnswer(fallbackAnswer);
      } finally {
        setLoadingAnswer(false);
      }
    }
    setShowAnswer(true);
    if (onUserActivity) onUserActivity(); // Cancel any pending AI encouragement
  };

  const handleTryAnotherQuestion = () => {
    setShowAnswer(false); // Reset answer visibility for new question
    if (onUserActivity) onUserActivity(); // Cancel any pending AI encouragement
    sendTextMessage("Can you give me another citizenship test practice question?");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="text-blue-600" size={16} />
          <span className="text-sm font-medium text-blue-800">Question #{question_number}</span>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">{category}</span>
        </div>
        <h3 className="font-semibold text-gray-900 mb-3">{question}</h3>
        
        {showAnswer ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded p-3">
              <strong className="text-green-800">Answer:</strong> 
              {loadingAnswer ? (
                <span className="text-green-600 italic"> Loading...</span>
              ) : (
                <span className="text-green-700"> {answer}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnswer(false)}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Hide Answer
              </button>
              <button
                onClick={handleTryAnotherQuestion}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
              >
                Try Another Question
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 italic">
              Think about your answer, then click below to see the correct response.
            </div>
            <button
              onClick={handleShowAnswer}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
            >
              Show Answer
            </button>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-600">
        <details>
          <summary className="cursor-pointer">View raw function call</summary>
          <pre className="bg-gray-100 rounded-md p-2 mt-1 overflow-x-auto">
            {JSON.stringify(functionCallOutput, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function _DatabaseInfo({ dbInfo }) {
  if (!dbInfo) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="text-green-600" size={14} />
        <span className="font-medium text-green-800">Database Status</span>
      </div>
      <div className="text-green-700">
        <p>{dbInfo.count} citizenship questions loaded</p>
        <p className="text-xs text-green-600">Model: {dbInfo.embedding_model}</p>
      </div>
    </div>
  );
}

export default function CitizenshipTestPanel({
  isSessionActive,
  sendClientEvent,
  events,
  sendTextMessage,
  isPaused,
}) {
  const [_functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [functionType, setFunctionType] = useState(null);
  const [_dbInfo, setDbInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [practiceQuestionTimer, setPracticeQuestionTimer] = useState(null);
  const wasPausedRef = useRef(isPaused);
  const currentQuestionRef = useRef(null);
  
  // Track processed function call IDs to prevent duplicate processing
  const processedFunctionCallIds = useRef(new Set());


  // Handle practice question request by matching AI's spoken question to database
  const handlePracticeQuestionRequest = useCallback(async (functionCall) => {
    console.log('🔍 DEBUG: handlePracticeQuestionRequest called with:', functionCall);
    try {
      const args = JSON.parse(functionCall.arguments);
      const spokenQuestion = args.question;
      
      console.log('AI spoke question:', spokenQuestion);
      console.log('Searching database for matching question...');
      
      // Search database for the question the AI spoke
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: spokenQuestion, limit: 1 })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const matchedQuestion = data.results[0];
        
        console.log('Found matching question in database:', matchedQuestion);
        
        // Create a function output with the matched database data
        const updatedFunctionOutput = {
          ...functionCall,
          arguments: JSON.stringify({
            category: matchedQuestion.metadata.category,
            question: matchedQuestion.metadata.question,
            question_number: matchedQuestion.metadata.question_id
          })
        };
        
        // Set this as the current function output
        setFunctionCallOutput(updatedFunctionOutput);
        setFunctionType("practice");
        
        // Start the 45-second timer for very gentle check-in
        if (practiceQuestionTimer) {
          clearTimeout(practiceQuestionTimer);
        }
        
        const timer = setTimeout(() => {
          console.log('45-second timer firing - sending very gentle check-in');
          sendClientEvent({
            type: "response.create",
            response: {
              instructions: `
                After 45 seconds of silence, provide a very brief, gentle check-in.
                Keep it short and non-pressuring. Let them know they can take their time.
                
                Example response: "Take all the time you need. Let me know if you'd like help or want to try another question."
                
                DO NOT: 
                - Repeat the question
                - Give hints about the answer
                - Be overly chatty or encouraging
                - Pressure them to respond faster
              `,
            },
          });
          setPracticeQuestionTimer(null);
        }, 45000);
        
        console.log('Setting 45-second practice question timer');
        setPracticeQuestionTimer(timer);
        
      } else {
        console.error('No matching question found in database for:', spokenQuestion);
      }
    } catch (error) {
      console.error('Error matching spoken question to database:', error);
    }
  }, [practiceQuestionTimer, sendClientEvent]);


  // Fetch database info on component mount
  useEffect(() => {
    async function fetchDbInfo() {
      try {
        const response = await fetch('/search/info');
        const data = await response.json();
        setDbInfo(data);
      } catch (error) {
        console.error('Failed to fetch database info:', error);
      }
    }
    
    fetchDbInfo();
  }, []);

  // Cancel practice question timer on any user activity
  useEffect(() => {
    if (!events || events.length === 0) return;
    
    // Check for user activity that should cancel the practice question timer
    const latestEvent = events[0];
    const userActivityEvents = [
      'input_audio_buffer.speech_started',
      'input_audio_buffer.committed'
    ];
    
    // Only clear timer for actual user speech, not AI conversation items
    const isUserSpeech = userActivityEvents.includes(latestEvent.type);
    const isUserConversationItem = latestEvent.type === 'conversation.item.created' && 
                                  latestEvent.item?.role === 'user';
    
    if ((isUserSpeech || isUserConversationItem) && practiceQuestionTimer) {
      console.log('User activity detected, clearing practice question timer:', latestEvent.type);
      clearTimeout(practiceQuestionTimer);
      setPracticeQuestionTimer(null);
    }
  }, [events, practiceQuestionTimer]);

  // Reset function state when transitioning from paused to active (but preserve practice questions)
  useEffect(() => {
    if (wasPausedRef.current && !isPaused && isSessionActive) {
      console.log('🔄 Detected resume from pause - resetting function added flag for new session');
      setFunctionAdded(false); // Reset so functions get re-added to new session
      console.log('🧹 Clearing currentQuestionRef to allow new questions after resume');
      currentQuestionRef.current = null; // Clear current question ref to allow new questions to be processed
      processedFunctionCallIds.current.clear(); // Clear processed function call IDs for new session
      // Note: We preserve functionCallOutput and functionType to keep practice question visible
    }
    wasPausedRef.current = isPaused;
  }, [isPaused, isSessionActive]);

  // Functions are now defined server-side, no need for client-side registration
  useEffect(() => {
    if (isSessionActive) {
      console.log('🔧 DEBUG: Session is active, functions are defined server-side');
      setFunctionAdded(true); // Mark as handled since server defines them
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Log all events to debug real application
    console.log('🔍 DEBUG: Current events count:', events.length);
    console.log('🔍 DEBUG: Recent events:', events.slice(0, 3).map(e => ({ type: e.type, hasResponse: !!e.response })));

    // Check all response.done events to see their structure
    const allResponseDoneEvents = events.filter(event => event.type === "response.done");
    if (allResponseDoneEvents.length > 0) {
      console.log('🔍 DEBUG: Found', allResponseDoneEvents.length, 'response.done events');
      allResponseDoneEvents.slice(0, 2).forEach((event, index) => {
        console.log(`🔍 DEBUG: Response ${index} structure:`, {
          hasResponse: !!event.response,
          hasOutput: !!event.response?.output,
          outputLength: event.response?.output?.length || 0,
          outputTypes: event.response?.output?.map(o => o.type) || []
        });
        
        if (event.response?.output) {
          event.response.output.forEach((output, outputIndex) => {
            console.log(`🔍 DEBUG: Response ${index} Output ${outputIndex}:`, {
              type: output.type,
              name: output.name,
              arguments: output.arguments?.substring?.(0, 100) + '...'
            });
          });
        }
      });
    }

    // Find the most recent response.done event with function calls
    const mostRecentResponseEvent = events.find(event => 
      event.type === "response.done" && 
      event.response?.output?.some(output => 
        output.type === "function_call" && 
        output.name === "request_practice_question"
      )
    );
    
    if (!mostRecentResponseEvent) {
      console.log('🔍 DEBUG: No practice question function call found in recent events');
      // Debug: Check if there are any function calls at all
      const anyFunctionCalls = events.filter(event => 
        event.type === "response.done" && 
        event.response?.output?.some(output => output.type === "function_call")
      );
      console.log('🔍 DEBUG: Total response.done events with any function calls:', anyFunctionCalls.length);
      if (anyFunctionCalls.length > 0) {
        console.log('🔍 DEBUG: Recent function calls found:', anyFunctionCalls.slice(0, 2).map(e => 
          e.response?.output?.filter(o => o.type === "function_call").map(o => o.name)
        ));
      }
    }
    
    if (mostRecentResponseEvent) {
      console.log('CitizenshipTestPanel - Processing most recent response event:', mostRecentResponseEvent.type);
      console.log('CitizenshipTestPanel - Response output:', mostRecentResponseEvent.response.output);
      
      mostRecentResponseEvent.response.output.forEach((output) => {
        console.log('Checking output type:', output.type, 'name:', output.name);
        if (output.type === "function_call") {
          if (output.name === "request_practice_question") {
            console.log('Practice question request detected:', output);
            
            // Check if we've already processed this specific function call
            const functionCallId = output.call_id || output.id || `${output.name}_${output.arguments}`;
            if (processedFunctionCallIds.current.has(functionCallId)) {
              console.log('⏭️ Skipping already processed function call ID:', functionCallId);
              return;
            }
            
            // Process new questions (allow language switching and different formulations)
            try {
              const newQuestion = JSON.parse(output.arguments).question;
              
              console.log('Question comparison - Current:', currentQuestionRef.current, 'New:', newQuestion);
              
              // Check if the displayed question matches what we expect
              const displayedQuestion = functionCallOutput && JSON.parse(functionCallOutput.arguments).question;
              console.log('🔍 DEBUG - Displayed question in sidebar:', displayedQuestion);
              
              // Always process if it's a different question or if sidebar shows different content
              const isDifferentQuestion = currentQuestionRef.current !== newQuestion;
              const sidebarMismatch = displayedQuestion && displayedQuestion !== newQuestion;
              const isFirstQuestion = !currentQuestionRef.current;
              
              if (isDifferentQuestion || isFirstQuestion || sidebarMismatch) {
                console.log('✅ Processing question request:', newQuestion);
                console.log('📊 Reason:', { isDifferentQuestion, isFirstQuestion, sidebarMismatch });
                currentQuestionRef.current = newQuestion;
                
                // Mark this function call as processed
                processedFunctionCallIds.current.add(functionCallId);
                console.log('🔖 Added function call ID to processed set:', functionCallId);
                
                handlePracticeQuestionRequest(output);
              } else {
                console.log('⚠️ Same question as currently displayed, skipping update');
                
                // Still mark as processed even if we skip, to avoid reprocessing
                processedFunctionCallIds.current.add(functionCallId);
              }
            } catch (error) {
              console.error('Error parsing function call arguments:', error);
              // Still call the handler for malformed arguments to maintain compatibility
              handlePracticeQuestionRequest(output);
            }
          } else if (output.name === "provide_current_official_info") {
            setFunctionCallOutput(output);
            setFunctionType("official");
            setTimeout(() => {
              sendClientEvent({
                type: "response.create",
                response: {
                  instructions: `
                    Ask if they'd like to know about other current officials or practice 
                    more citizenship questions. Be encouraging about their test preparation.
                  `,
                },
              });
            }, 500);
          }
        }
      });
    }
  }, [events, functionCallOutput, handlePracticeQuestionRequest, sendClientEvent]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setFunctionType(null);
    }
  }, [isSessionActive]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 3 })
      });
      
      const data = await response.json();
      
      // Send the search results as a message to the assistant
      const resultsMessage = `Here are the top citizenship questions related to "${searchQuery}":\n\n` +
        data.results.map((result, index) => 
          `${index + 1}. ${result.metadata.question}\n   Answer: ${result.metadata.answer}\n`
        ).join('\n');
      
      if (sendTextMessage) {
        sendTextMessage(resultsMessage);
      }
      
      setSearchQuery("");
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const _quickActions = [
    {
      text: "Who is the current president?",
      action: () => sendTextMessage && sendTextMessage("Who is the current president?")
    },
    {
      text: "Who is the vice president?",
      action: () => sendTextMessage && sendTextMessage("Who is the vice president?")
    },
    {
      text: "Give me a practice question",
      action: () => sendTextMessage && sendTextMessage("Can you give me a citizenship test practice question?")
    },
    {
      text: "Test me on the Constitution",
      action: () => sendTextMessage && sendTextMessage("Test my knowledge about the Constitution")
    },
    {
      text: "Ask about government",
      action: () => sendTextMessage && sendTextMessage("What should I know about the US government for the citizenship test?")
    }
  ];

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4 flex flex-col gap-4">

        {isSessionActive ? (
          <div className="flex flex-col gap-4 flex-1">
            {/* Search Box */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search citizenship topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                aria-label="Search citizenship topics"
              >
                <Search size={16} />
              </button>
            </div>


            {/* Function Output */}
            {functionCallOutput ? (
              <div className="flex-1">
                <h3 className="text-sm font-medium mb-2">
                  {functionType === "official" ? "Current Official" : "Practice Question"}
                </h3>
                {functionType === "official" ? (
                  <CurrentOfficialOutput functionCallOutput={functionCallOutput} />
                ) : (
                  <PracticeQuestionOutput 
                    functionCallOutput={functionCallOutput} 
                    sendTextMessage={sendTextMessage}
                    onUserActivity={() => {
                      if (practiceQuestionTimer) {
                        clearTimeout(practiceQuestionTimer);
                        setPracticeQuestionTimer(null);
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                Ask me anything about the US citizenship test!
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BookOpen className="mx-auto mb-2 text-gray-400" size={24} />
              <p>Start the session to begin practicing for your citizenship test</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}