import React from 'react';
import { FaVideo } from 'react-icons/fa';
import './VideoCallNotification.css';

const VideoCallNotification = ({ 
  caller, 
  channel, 
  onJoin, 
  onDismiss 
}) => {
  return (
    <div className="video-call-notification">
      <div className="notification-content">
        <FaVideo className="video-icon" />
        <div className="notification-text">
          <strong>{caller}</strong> начал видеосеанс в канале <strong>#{channel}</strong>
        </div>
        <div className="notification-actions">
          <button className="join-btn" onClick={onJoin}>
            Присоединиться
          </button>
          <button className="dismiss-btn" onClick={onDismiss}>
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallNotification;
