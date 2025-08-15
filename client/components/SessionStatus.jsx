import React, { useState, useEffect } from 'react';
import { Clock, Pause, Play, AlertTriangle, X } from 'react-feather';

export default function SessionStatus({ 
  isSessionActive, 
  sessionStartTime, 
  lastActivityTime, 
  isPaused, 
  pausedAt,
  totalPausedTime,
  showTimeoutWarning, 
  onPause, 
  onResume, 
  onStopSession,
  onDismissWarning 
}) {
  const [sessionDuration, setSessionDuration] = useState(0);
  const [inactiveTime, setInactiveTime] = useState(0);

  // Update session duration every second
  useEffect(() => {
    if (!isSessionActive || !sessionStartTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      // Calculate total elapsed time
      const totalElapsed = now - sessionStartTime;
      
      // Calculate current pause duration if currently paused
      const currentPauseDuration = isPaused && pausedAt ? (now - pausedAt) : 0;
      
      // Billable time = total time - total paused time - current pause duration
      const billableTime = totalElapsed - totalPausedTime - currentPauseDuration;
      
      setSessionDuration(Math.max(0, billableTime));
      
      if (lastActivityTime && !isPaused) {
        setInactiveTime(now - lastActivityTime);
      } else {
        setInactiveTime(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime, lastActivityTime, isPaused, pausedAt, totalPausedTime]);

  // Format time duration in MM:SS format
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Estimate cost (rough estimate: $0.06 per minute of realtime API usage)
  function estimateCost(ms) {
    const minutes = ms / (1000 * 60);
    const cost = minutes * 0.06;
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(2)}`;
  }

  if (!isSessionActive) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm">
      {/* Timeout Warning */}
      {showTimeoutWarning && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">
              Session will auto-disconnect in 2 minutes due to inactivity
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Send a message or pause the session to prevent auto-disconnect
            </p>
          </div>
          <button
            onClick={onDismissWarning}
            className="text-orange-400 hover:text-orange-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Session Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <div className="text-sm">
              <span className="font-medium">{formatDuration(sessionDuration)}</span>
              <span className="text-gray-500 ml-2">({estimateCost(sessionDuration)})</span>
            </div>
          </div>
          
          {isPaused ? (
            <div className="flex items-center gap-1 text-orange-600 text-sm">
              <Pause className="w-3 h-3" />
              <span>Paused</span>
            </div>
          ) : (
            inactiveTime > 30000 && ( // Show inactive time after 30 seconds
              <div className="text-xs text-gray-500">
                Inactive: {formatDuration(inactiveTime)}
              </div>
            )
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isPaused ? (
            <button
              onClick={onResume}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          )}
          
          <button
            onClick={onStopSession}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}