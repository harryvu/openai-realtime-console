import { useEffect, useState } from "react";
import { BookOpen, HelpCircle, Award, Search } from "react-feather";

const functionDescription = `
Call this function when a user asks for citizenship test practice questions or wants to test their knowledge.
`;

const currentOfficialsDescription = `
Call this function when a user asks about current government officials like the President, Vice President, or governors.
`;

const sessionUpdate = {
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
        name: "provide_practice_question",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            category: {
              type: "string",
              description: "Category of the citizenship question (Constitution & Law, Government, History, etc.)",
            },
            question: {
              type: "string",
              description: "The practice question from the USCIS 100 civics questions",
            },
            answer: {
              type: "string", 
              description: "The official answer to the question",
            },
            question_number: {
              type: "number",
              description: "The question number from the official USCIS list",
            }
          },
          required: ["category", "question", "answer", "question_number"],
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

function PracticeQuestionOutput({ functionCallOutput }) {
  const { category, question, answer, question_number } = JSON.parse(functionCallOutput.arguments);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="text-blue-600" size={16} />
          <span className="text-sm font-medium text-blue-800">Question #{question_number}</span>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">{category}</span>
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">{question}</h3>
        <div className="text-sm text-gray-700">
          <strong>Answer:</strong> {answer}
        </div>
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

function DatabaseInfo({ dbInfo }) {
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
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [functionType, setFunctionType] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    if (!events || events.length === 0) return;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (output.type === "function_call") {
          if (output.name === "provide_practice_question") {
            setFunctionCallOutput(output);
            setFunctionType("practice");
            setTimeout(() => {
              sendClientEvent({
                type: "response.create",
                response: {
                  instructions: `
                    Ask if they want to try another practice question or if they have 
                    any questions about this topic. Be encouraging about their citizenship test preparation.
                  `,
                },
              });
            }, 500);
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
  }, [events]);

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

  const quickActions = [
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
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="text-blue-600" size={20} />
            US Citizenship Test Assistant
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Practice with official USCIS questions and get grounded answers
          </p>
        </div>

        <DatabaseInfo dbInfo={dbInfo} />

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
              >
                <Search size={16} />
              </button>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                <HelpCircle size={14} />
                Quick Start
              </h3>
              <div className="grid grid-cols-1 gap-1">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className="text-left text-sm bg-white border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    {action.text}
                  </button>
                ))}
              </div>
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
                  <PracticeQuestionOutput functionCallOutput={functionCallOutput} />
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