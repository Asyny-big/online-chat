import React, { useState, useEffect, useRef } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';
import './VideoCallModal.css';

const VideoCallModal = ({ 
  isOpen, 
  onClose, 
  participants, 
  currentUser, 
  socket,
  channel 
}) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});

  useEffect(() => {
    if (isOpen) {
      startLocalStream();
    }
    return () => {
      stopLocalStream();
    };
  }, [isOpen]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Ошибка доступа к камере/микрофону:', error);
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    stopLocalStream();
    socket.emit('leave-video-call', { channel });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="video-call-modal">
      <div className="video-call-container">
        <div className="video-call-header">
          <h3>Видеозвонок #{channel}</h3>
          <button className="close-btn" onClick={endCall}>×</button>
        </div>
        
        <div className="video-grid">
          <div className="video-participant">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="video-stream"
            />
            <span className="participant-name">{currentUser} (Вы)</span>
          </div>
          
          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <div key={userId} className="video-participant">
              <video
                autoPlay
                className="video-stream"
                ref={el => {
                  if (el && stream) el.srcObject = stream;
                }}
              />
              <span className="participant-name">
                {participants.find(p => p.id === userId)?.username || 'Участник'}
              </span>
            </div>
          ))}
        </div>

        <div className="video-controls">
          <button 
            className={`control-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          
          <button 
            className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
            onClick={toggleVideo}
          >
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
          
          <button className="control-btn end-call" onClick={endCall}>
            <FaPhoneSlash />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
