import React, { useState, useEffect } from 'react';
import { AuthButton } from './AuthButton';
import { BookOpen, Users, Award } from 'react-feather';
import logo from '/assets/united-states.png';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(`Authentication failed with ${errorParam}. Please try again.`);
    }
  }, []);

  const handleLogin = (provider) => {
    setIsLoading(true);
    setError(null);
    window.location.href = `/auth/${provider}`;
  };

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/auth/dev', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        window.location.reload();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Development login failed');
      }
    } catch (err) {
      setError('Network error during development login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center">
              <img src={logo} alt="US Flag" className="w-16 h-16 object-cover" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            US Citizenship Test Assistant
          </h1>
          <p className="text-gray-600">
            Prepare for your naturalization civics test with official USCIS materials
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            Sign in to continue
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <AuthButton
              user={null}
              provider="google"
              onLogin={handleLogin}
              isLoading={isLoading}
            />
            <AuthButton
              user={null}
              provider="facebook"
              onLogin={handleLogin}
              isLoading={isLoading}
            />
            <AuthButton
              user={null}
              provider="microsoft"
              onLogin={handleLogin}
              isLoading={isLoading}
            />
            
            {/* Development login button */}
            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={handleDevLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>🔧</span>
                {isLoading ? 'Connecting...' : 'Development Login (Testing)'}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              By signing in, you agree to use this app for educational purposes only.
              Your progress will be saved to help track your study sessions.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 gap-4 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>100 official USCIS civics questions</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Current government officials information</span>
          </div>
          <div className="flex items-center gap-3 text-gray-600">
            <Award className="w-5 h-5 text-blue-600" />
            <span>Track your progress and performance</span>
          </div>
        </div>
      </div>
    </div>
  );
}