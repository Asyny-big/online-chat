import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { getTransactions } from '../economy/api';
import { useHrumToast } from './HrumToast';

function MessageInput({ chatId, socket, token, onTyping }) {
  const { showEarn } = useHrumToast();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastEconomyProbeAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e) => {
    setInput(e.target.value);

    if (socket && chatId) {
      socket.emit('typing:start', { chatId });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { chatId });
      }, 2000);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() || !chatId || !socket) return;

    const text = input.trim();

    socket.emit('message:send', {
      chatId,
      text,
      type: 'text'
    }, (response) => {
      if (!response?.success) return;
      if (!token) return;
      if (String(text).trim().length < 20) return;

      const now = Date.now();
      if (now - lastEconomyProbeAtRef.current < 1200) return;
      lastEconomyProbeAtRef.current = now;

      setTimeout(async () => {
        try {
          const data = await getTransactions({ token, limit: 1 });
          const t = data?.items?.[0];
          if (!t || t.reasonCode !== 'earn:message') return;
          const raw = String(t.deltaHrum ?? '').trim();
          const abs = raw.startsWith('-') ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
          if (!abs) return;
          showEarn({ amountHrum: abs, txId: t.id });
        } catch (_) { }
      }, 650);
    });

    setInput('');
    socket.emit('typing:stop', { chatId });
  };

  const handleFileSelect = () => fileInputRef.current?.click();

  const uploadFile = async (file) => {
    if (!file || !chatId) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('Максимальный размер файла: 20 МБ');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const type = (() => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
        if (imageExts.includes(ext)) return 'image';
        if (videoExts.includes(ext)) return 'video';
        return 'file';
      })();

      socket.emit('message:send', {
        chatId,
        type,
        text: '',
        attachment: {
          url: res.data.url,
          originalName: res.data.originalName,
          mimeType: res.data.mimeType,
          size: res.data.size
        }
      });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else mimeType = '';
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        if (audioBlob.size > 0) {
          await uploadVoiceMessage(audioBlob, actualMimeType);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (err) {
      alert('Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      audioChunksRef.current = [];
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadVoiceMessage = async (blob, mimeType) => {
    setUploading(true);
    try {
      let extension = '.webm';
      if (mimeType.includes('ogg')) extension = '.ogg';
      else if (mimeType.includes('mp4') || mimeType.includes('m4a')) extension = '.m4a';
      else if (mimeType.includes('mpeg') || mimeType.includes('mp3')) extension = '.mp3';

      const formData = new FormData();
      formData.append('file', blob, `voice_${Date.now()}${extension}`);

      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      socket.emit('message:send', {
        chatId,
        type: 'audio',
        text: '',
        attachment: {
          url: res.data.url,
          originalName: 'Голосовое сообщение',
          mimeType: mimeType || 'audio/webm',
          size: res.data.size
        }
      });
    } catch (err) {
      alert('Ошибка отправки голосового');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const canSend = input.trim().length > 0 && !uploading;

  return (
    <div
      className={`message-input-container ${isDragging ? 'dragging-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <span style={{ color: 'white', fontWeight: 600, fontSize: '1.2rem' }}>📎 Отпустите для загрузки</span>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
      />

      {isRecording ? (
        <div className="recording-ui">
          <div className="recording-indicator">
            <span className="recording-dot" />
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </div>
          <div className="recording-actions">
            <button onClick={cancelRecording} className="cancel-record-btn" title="Отмена">✕</button>
            <button onClick={stopRecording} className="send-btn" title="Отправить">➤</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="message-form">
          <button
            type="button"
            onClick={handleFileSelect}
            className="input-action-btn"
            disabled={uploading}
            title="Прикрепить файл"
          >
            📎
          </button>

          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={handleInputChange}
            placeholder={uploading ? 'Загрузка...' : 'Напишите сообщение...'}
            disabled={uploading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {input.trim() ? (
            <button type="submit" className="send-btn" disabled={!canSend}>
              ➤
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="input-action-btn"
              disabled={uploading}
              title="Голосовое сообщение"
            >
              🎤
            </button>
          )}
        </form>
      )}
    </div>
  );
}

export default MessageInput;
