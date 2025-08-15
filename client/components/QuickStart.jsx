import React from 'react';
import { HelpCircle, Award, BookOpen, Users } from 'react-feather';

export default function QuickStart({ sendTextMessage, isSessionActive }) {
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
    <div className="h-full flex flex-col p-4">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Award className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          US Citizenship Test Assistant
        </h1>
        <p className="text-gray-600">
          Practice with official USCIS questions and get grounded answers
        </p>
      </div>

      {/* Quick Start Actions */}
      <div className="flex-1">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HelpCircle size={20} className="text-blue-600" />
          Quick Start
        </h3>
        
        <div className="grid grid-cols-1 gap-3 mb-8">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              disabled={!isSessionActive}
              className="text-left text-lg bg-white border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {action.text}
            </button>
          ))}
        </div>

        {/* Features Section */}
        <div className="mt-8 space-y-4">
          <h4 className="text-md font-medium text-gray-900 mb-3">Features</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span className="text-sm">100 official USCIS civics questions</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm">Current government officials information</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Award className="w-5 h-5 text-blue-600" />
              <span className="text-sm">AI-powered voice and text interaction</span>
            </div>
          </div>
        </div>

        {!isSessionActive && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Start a session to begin practicing with the citizenship test assistant. 
              You can ask questions by voice or text.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}