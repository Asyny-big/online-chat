import React, { useEffect, useState } from 'react';
import VideoCallModal from '../VideoCall/VideoCallModal';
import VideoCallNotification from '../VideoCall/VideoCallNotification';
import ChatHeader from './ChatHeader';

const Chat = ({ socket, currentUser, selectedChannel }) => {
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [videoCallNotification, setVideoCallNotification] = useState(null);
  const [videoCallParticipants, setVideoCallParticipants] = useState([]);

  useEffect(() => {
    socket.on('video-call-started', (data) => {
      if (data.caller !== currentUser) {
        setVideoCallNotification({
          caller: data.caller,
          channel: data.channel
        });
      }
    });

    socket.on('video-call-ended', () => {
      setIsVideoCallOpen(false);
      setVideoCallNotification(null);
    });

    return () => {
      socket.off('video-call-started');
      socket.off('video-call-ended');
    };
  }, [socket, currentUser]);

  const startVideoCall = () => {
    socket.emit('start-video-call', { 
      channel: selectedChannel,
      caller: currentUser 
    });
    setIsVideoCallOpen(true);
  };

  const joinVideoCall = () => {
    setIsVideoCallOpen(true);
    setVideoCallNotification(null);
  };

  const dismissVideoNotification = () => {
    setVideoCallNotification(null);
  };

  return (
    <div className="chat-container">
      <div className="chat-section">
        <ChatHeader 
          channel={selectedChannel}
          onStartVideoCall={startVideoCall}
        />
        {/* ...existing code... */}
      </div>

      {videoCallNotification && (
        <VideoCallNotification
          caller={videoCallNotification.caller}
          channel={videoCallNotification.channel}
          onJoin={joinVideoCall}
          onDismiss={dismissVideoNotification}
        />
      )}

      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        participants={videoCallParticipants}
        currentUser={currentUser}
        socket={socket}
        channel={selectedChannel}
      />
    </div>
  );
};

export default Chat;