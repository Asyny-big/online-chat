import React from 'react';
import { FaVideo } from 'react-icons/fa';
import './ChatHeader.css';

const ChatHeader = ({ channel, onStartVideoCall }) => {
  return (
    <div className="chat-header">
      <h2>#{channel}</h2>
      <div className="chat-actions">
        <span>Чат</span>
        <button 
          className="video-call-btn"
          onClick={onStartVideoCall}
          title="Начать видеозвонок"
        >
          <FaVideo />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
