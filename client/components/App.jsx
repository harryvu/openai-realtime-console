import { useEffect, useRef, useState } from "react";
import logo from "/assets/united-states.png";
import QuickStart from "./QuickStart";
import SessionControls from "./SessionControls";
import CitizenshipTestPanel from "./CitizenshipTestPanel";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { AuthButton } from "./AuthButton";

function CitizenshipApp() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  async function startSession() {
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
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
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
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model with RAG enhancement
  async function sendTextMessage(message) {
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
