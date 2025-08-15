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

  // Configuration constants
  const INACTIVITY_TIMEOUT = 8 * 60 * 1000; // 8 minutes
  const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout

  // Reset activity timer and clear warnings
  function resetActivityTimer() {
    const now = Date.now();
    setLastActivityTime(now);
    setShowTimeoutWarning(false);

    // Clear existing timeouts
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Only set timeouts if session is active and not paused
    if (isSessionActive && !isPaused) {
      // Set warning timeout (show warning 2 minutes before disconnect)
      warningTimeoutRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, INACTIVITY_TIMEOUT - WARNING_TIME);

      // Set disconnect timeout
      activityTimeoutRef.current = setTimeout(() => {
        console.log('Auto-disconnecting due to inactivity');
        stopSession();
      }, INACTIVITY_TIMEOUT);
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
        // Restore session state
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
    setIsPaused(false);
    setPausedAt(null);
    setTotalPausedTime(0);
    peerConnection.current = null;
    pausedSessionState.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
      
      // Track user activity
      resetActivityTimer();
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

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        setEvents((prev) => [event, ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
        // Start activity monitoring
        resetActivityTimer();
      });
    }
  }, [dataChannel]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center justify-between w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <div className="flex items-center gap-4">
            <img style={{ width: "24px" }} src={logo} />
            <h1>US Citizenship Test Assistant</h1>
          </div>
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
