import { useEffect, useRef, useState } from "react";
import logo from "/assets/united-states.png";
import QuickStart from "./QuickStart";
import SessionControls from "./SessionControls";
import SessionStatus from "./SessionStatus";
import CitizenshipTestPanel from "./CitizenshipTestPanel";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { AuthButton } from "./AuthButton";

function CitizenshipApp() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [lastActivityTime, setLastActivityTime] = useState(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState(null);
  const [totalPausedTime, setTotalPausedTime] = useState(0);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const activityTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const pausedSessionState = useRef(null);
  const [isInWarningPeriod, setIsInWarningPeriod] = useState(false);
  const isInWarningPeriodRef = useRef(false);
  const isResumingRef = useRef(false);

  // Configuration constants
  const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes (using VAD detection)
  const WARNING_TIME = 30 * 1000; // Show warning 30 seconds before timeout

  // Reset activity timer and clear warnings
  function resetActivityTimer() {
    const now = Date.now();
    setLastActivityTime(now);
    setShowTimeoutWarning(false);
    setIsInWarningPeriod(false);
    isInWarningPeriodRef.current = false;

    // Clear existing timeouts
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      console.log('Cleared activity timeout');
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      console.log('Cleared warning timeout');
    }

    // Only set timeouts if session is active and not paused
    if (isSessionActive && !isPaused) {
      console.log(`Setting inactivity timers - Warning in ${(INACTIVITY_TIMEOUT - WARNING_TIME) / 1000}s, Disconnect in ${INACTIVITY_TIMEOUT / 1000}s`);
      
      // Set warning timeout (AI speaks inactivity warning)
      warningTimeoutRef.current = setTimeout(() => {
        console.log('AI speaking inactivity warning - entering warning period');
        setShowTimeoutWarning(true);
        setIsInWarningPeriod(true);
        isInWarningPeriodRef.current = true;
        
        // Have the AI speak the warning instead of just showing UI
        const warningMessage = "I haven't heard from you in a while. Should we continue this session, or would you like me to pause to save on costs? Just say 'continue' or 'pause' to let me know.";
        
        const warningEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: warningMessage,
              },
            ],
          },
        };
        
        sendClientEvent(warningEvent, true); // Skip activity reset for warning
        sendClientEvent({ type: "response.create" }, true);
      }, INACTIVITY_TIMEOUT - WARNING_TIME);

      // Set pause timeout
      activityTimeoutRef.current = setTimeout(() => {
        console.log('Auto-pausing due to inactivity');
        pauseSession();
      }, INACTIVITY_TIMEOUT);
    } else {
      console.log('Not setting timers - Session active:', isSessionActive, 'Paused:', isPaused);
    }
  }

  // Pause session to stop billing - actually closes the connection
  function pauseSession() {
    if (dataChannel && isSessionActive && !isPaused) {
      console.log('Pausing session - closing connection to stop billing');
      
      // Store session state for resume
      pausedSessionState.current = {
        events: [...events],
        sessionStartTime,
        lastActivityTime,
      };
      
      // Close connection to stop billing
      if (dataChannel) {
        dataChannel.close();
      }
      
      if (peerConnection.current) {
        peerConnection.current.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        peerConnection.current.close();
      }
      
      // Clear timers
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      setShowTimeoutWarning(false);
      
      // Set paused state but keep session marked as "active" for UI
      setIsPaused(true);
      setPausedAt(Date.now());
      setDataChannel(null);
      peerConnection.current = null;
    }
  }

  // Resume session - creates new connection
  async function resumeSession() {
    if (isPaused && pausedSessionState.current) {
      console.log('Resuming session - creating new connection');
      
      try {
        // Set flag to indicate we're resuming (prevents event clearing)
        isResumingRef.current = true;
        
        // Restore session state but clear function call outputs
        setEvents(pausedSessionState.current.events);
        setSessionStartTime(pausedSessionState.current.sessionStartTime);
        setLastActivityTime(Date.now()); // Update to current time
        
        // Create new session
        await startSession(true);
        
        // Calculate and accumulate paused time
        if (pausedAt) {
          const pauseDuration = Date.now() - pausedAt;
          setTotalPausedTime(prev => prev + pauseDuration);
        }
        
        // Clear paused state
        setIsPaused(false);
        setPausedAt(null);
        pausedSessionState.current = null;
        isResumingRef.current = false; // Clear resume flag
        
        console.log('Session resumed successfully');
      } catch (error) {
        console.error('Failed to resume session:', error);
        // If resume fails, stop the session completely
        stopSession();
      }
    }
  }

  // Dismiss timeout warning (user acknowledged it)
  function dismissTimeoutWarning() {
    setShowTimeoutWarning(false);
    setIsInWarningPeriod(false);
    isInWarningPeriodRef.current = false;
    // Reset activity timer to give user more time
    resetActivityTimer();
  }

  async function startSession(isResume = false) {
    // Get a session token for OpenAI Realtime API
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
    
    // Initialize session timing only for new sessions, not resume
    if (!isResume) {
      const now = Date.now();
      setSessionStartTime(now);
      setLastActivityTime(now);
    }
    setIsPaused(false);
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    console.log('Stopping session - cleaning up all connections and state');
    
    // Clear all timers
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Clean up connection if it exists (may not exist if paused)
    if (dataChannel) {
      dataChannel.close();
    }

    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      peerConnection.current.close();
    }

    // Reset all session state - this should work whether paused or active
    setIsSessionActive(false);
    setDataChannel(null);
    setSessionStartTime(null);
    setLastActivityTime(null);
    setShowTimeoutWarning(false);
    setIsInWarningPeriod(false);
    isInWarningPeriodRef.current = false;
    setIsPaused(false);
    setPausedAt(null);
    setTotalPausedTime(0);
    peerConnection.current = null;
    pausedSessionState.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message, skipActivityReset = false) {
    if (dataChannel) {
      // Debug session.update events
      if (message.type === 'session.update') {
        console.log('🔧 Sending session.update to OpenAI:', JSON.stringify(message, null, 2));
      }
      
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
      
      // Track user activity (unless this is a system message like inactivity warning)
      if (!skipActivityReset) {
        resetActivityTimer();
      }
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model with RAG enhancement
  async function sendTextMessage(message) {
    // Track user activity immediately when they send a message
    resetActivityTimer();
    
    try {
      // Enhance the message with relevant citizenship context
      const response = await fetch('/enhance-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      const enhancementData = await response.json();
      const finalMessage = enhancementData.enhancedMessage || message;
      
      console.log('Enhanced message:', {
        original: message,
        enhanced: finalMessage,
        hasContext: enhancementData.hasContext
      });

      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: finalMessage,
            },
          ],
        },
      };

      sendClientEvent(event);
      sendClientEvent({ type: "response.create" });
    } catch (error) {
      console.error('Failed to enhance message, sending original:', error);
      
      // Fallback to original message if enhancement fails
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      };

      sendClientEvent(event);
      sendClientEvent({ type: "response.create" });
    }
  }


  // Check for voice commands in transcription completion events
  function checkForVoiceCommandsFromTranscript(event) {
    const transcript = event.transcript;
    
    if (!transcript || typeof transcript !== 'string') {
      return false;
    }
    
    const text = transcript.toLowerCase().trim();
    
    // Check for pause commands
    const pauseCommands = ['pause', 'please pause', 'pause session', 'pause the session', 'stop for now'];
    const continueCommands = ['continue', 'keep going', 'resume', 'go on', 'carry on'];
    
    const isPauseCommand = pauseCommands.some(cmd => 
      text === cmd || text.includes(cmd)
    );
    
    const isContinueCommand = continueCommands.some(cmd => 
      text === cmd || text.includes(cmd)
    );
    
    if (isPauseCommand && isSessionActive && !isPaused) {
      console.log('Voice command detected: PAUSE');
      pauseSession();
      return true; // Command was processed
    } else if (isContinueCommand) {
      if (isPaused) {
        console.log('Voice command detected: CONTINUE (resuming paused session)');
        resumeSession();
        return true; // Command was processed
      } else if (isInWarningPeriodRef.current) {
        console.log('Voice command detected: CONTINUE (acknowledging warning)');
        // User acknowledged the warning, reset timer and exit warning period
        setIsInWarningPeriod(false);
        isInWarningPeriodRef.current = false;
        resetActivityTimer();
        return true; // Command was processed
      }
    }
    
    return false; // No command was processed
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list and track activity
      const handleMessage = (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }


        // Debug logging for important events
        if (event.type === "response.done") {
          console.log('🔍 DEBUG: OpenAI response.done event');
          if (event.response?.output) {
            console.log('🔍 DEBUG: Response output count:', event.response.output.length);
            event.response.output.forEach((output, index) => {
              console.log(`🔍 DEBUG: Output ${index}:`, {
                type: output.type,
                name: output.name,
                arguments: output.arguments
              });
            });
          } else {
            console.log('🔍 DEBUG: No response.output found');
          }
        }
        
        // Debug error events
        if (event.type === "error") {
          console.error('🚨 OpenAI ERROR:', event.error);
        }
        
        setEvents((prev) => [event, ...prev]);
        
        // Check for voice commands in conversation items
        let voiceCommandProcessed = false;
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          voiceCommandProcessed = checkForVoiceCommandsFromTranscript(event);
        }
        
        // Reset activity timer on meaningful speech and conversation events
        // During warning period, only user speech should reset timer
        const isUserActivity = event.type === 'input_audio_buffer.speech_started' || 
                              event.type === 'input_audio_buffer.speech_stopped';
        const isAIActivity = event.type === 'response.done' || 
                            event.type === 'conversation.item.created';
        
        if (isUserActivity || (isAIActivity && !isInWarningPeriodRef.current)) {
          console.log('VAD activity detected:', event.type, 'Warning period:', isInWarningPeriodRef.current);
          if (isUserActivity && isInWarningPeriodRef.current) {
            console.log('User responded during warning period - exiting warning mode');
            setIsInWarningPeriod(false);
            isInWarningPeriodRef.current = false;
          }
          resetActivityTimer();
        } else if (isAIActivity && isInWarningPeriodRef.current) {
          console.log('Ignoring AI activity during warning period:', event.type);
        }
      };

      const handleOpen = () => {
        console.log('Data channel opened - isResuming:', isResumingRef.current);
        setIsSessionActive(true);
        
        // Only clear events if NOT resuming from pause
        if (!isResumingRef.current) {
          console.log('Clearing events for new session');
          setEvents([]);
        } else {
          console.log('Preserving events during resume');
        }
        
        // Configure server VAD for reliable speech detection and enable transcription
        const vadConfigEvent = {
          type: "session.update",
          session: {
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            input_audio_transcription: {
              model: "whisper-1"
            }
          }
        };
        
        dataChannel.send(JSON.stringify(vadConfigEvent));
        console.log('Configured server VAD for speech detection');
        
        // Start activity monitoring
        resetActivityTimer();
      };

      dataChannel.addEventListener("message", handleMessage);
      dataChannel.addEventListener("open", handleOpen);

      // Cleanup event listeners
      return () => {
        dataChannel.removeEventListener("message", handleMessage);
        dataChannel.removeEventListener("open", handleOpen);
      };
    }
  }, [dataChannel, isSessionActive, isPaused]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center justify-between w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <div></div>
          <AuthButton 
            user={useAuth().user} 
            onLogout={useAuth().logout}
            isLoading={useAuth().loading}
          />
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0 flex">
        <section className="flex-1 min-w-0 flex flex-col">
          <section className="flex-1 overflow-y-auto">
            <div className="p-4">
              <SessionStatus
                isSessionActive={isSessionActive}
                sessionStartTime={sessionStartTime}
                lastActivityTime={lastActivityTime}
                isPaused={isPaused}
                pausedAt={pausedAt}
                totalPausedTime={totalPausedTime}
                showTimeoutWarning={showTimeoutWarning}
                onPause={pauseSession}
                onResume={resumeSession}
                onStopSession={stopSession}
                onDismissWarning={dismissTimeoutWarning}
              />
            </div>
            <QuickStart 
              sendTextMessage={sendTextMessage}
              isSessionActive={isSessionActive}
            />
          </section>
          <section className="h-32 p-4 flex-shrink-0">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="sidebar-responsive p-4 pt-0 overflow-y-auto flex-shrink-0">
          <CitizenshipTestPanel
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
            isPaused={isPaused}
          />
        </section>
      </main>
    </>
  );
}

function AppWithAuth() {
  const { user, loading } = useAuth();
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }
  
  // Show main app if authenticated
  return <CitizenshipApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}
