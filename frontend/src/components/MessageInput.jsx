import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { getTransactions } from '@/economy/api';
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

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Индикатор «печатает»
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

  // === ФАЙЛЫ ===
  const handleFileSelect = () => fileInputRef.current?.click();

  const uploadFile = async (file) => {
    if (!file || !chatId) return;

    // Лимит 100 МБ
    if (file.size > 100 * 1024 * 1024) {
      alert('Максимальный размер файла: 100 МБ');
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

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const type = (() => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        // Fallback по расширению если браузер не определил MIME-тип
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

  // Drag & Drop
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

  // === ГОЛОСОВЫЕ СООБЩЕНИЯ ===
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Определяем поддерживаемый MIME-тип
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = ''; // Использовать дефолтный
        }
      }

      console.log('[MessageInput] Recording with mimeType:', mimeType);

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });

        console.log('[MessageInput] Recording stopped, blob size:', audioBlob.size, 'type:', actualMimeType);

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
      console.error('Microphone access denied:', err);
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
      // Определяем расширение файла на основе MIME-типа
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

      console.log('[MessageInput] Voice uploaded:', res.data);

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
      console.error('Voice upload error:', err);
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
      className={`message-input-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <span className="drop-text">📎 Отпустите для загрузки</span>
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
        // Режим записи
        <div className="recording-row">
          <div className="recording-indicator">
            <span className="recording-dot" />
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </div>
          <button onClick={cancelRecording} className="icon-btn-circle cancel" title="Отмена">
            ✕
          </button>
          <button onClick={stopRecording} className="icon-btn-circle send-voice" title="Отправить">
            ➤
          </button>
        </div>
      ) : (
        // Обычный режим
        <form onSubmit={handleSend} className="input-form">
          <button
            type="button"
            onClick={handleFileSelect}
            className="icon-btn-circle attachment"
            disabled={uploading}
            title="Прикрепить файл"
          >
            📎
          </button>

          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={uploading ? 'Загрузка...' : 'Введите сообщение...'}
            className="message-input-field"
            disabled={uploading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {input.trim() ? (
            <button
              type="submit"
              className={`icon-btn-circle send ${!canSend ? 'disabled' : ''}`}
              disabled={!canSend}
            >
              ➤
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="icon-btn-circle mic"
              disabled={uploading}
              title="Голосовое сообщение"
            >
              🎤
            </button>
          )}
        </form>
      )}

      <style>{`
        .message-input-container {
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            background-color: var(--bg-surface);
            position: relative;
        }

        .message-input-container.dragging {
            background-color: rgba(59, 130, 246, 0.1);
            border: 2px dashed var(--accent);
        }

        .drop-overlay {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(30, 64, 175, 0.9); border-radius: 8px; z-index: 10;
        }
        .drop-text { color: white; font-size: 16px; font-weight: 600; }

        .input-form { display: flex; align-items: center; gap: 8px; }

        .message-input-field {
            flex: 1; padding: 12px 16px; background-color: var(--bg-input);
            border: 1px solid var(--border-input); borderRadius: 24px;
            color: var(--text-primary); fontSize: 14px; outline: none; transition: border-color 0.2s;
        }
        .message-input-field:focus { border-color: var(--accent); }

        .icon-btn-circle {
            width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
            background: transparent; border: none; borderRadius: 50%; fontSize: 20px;
            cursor: pointer; transition: background 0.2s; color: var(--text-secondary);
        }
        .icon-btn-circle:hover { background-color: var(--bg-hover); color: var(--text-primary); }

        .icon-btn-circle.send { background-color: var(--accent); color: white; fontSize: 16px; }
        .icon-btn-circle.send:hover { background-color: var(--accent-hover); }
        .icon-btn-circle.send.disabled { background-color: var(--bg-disabled); cursor: not-allowed; opacity: 0.7; }

        .icon-btn-circle.mic { background-color: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border-color); }
        .icon-btn-circle.mic:hover { background-color: var(--bg-hover); color: var(--accent); border-color: var(--accent); }
        
        .icon-btn-circle.attachment:hover { color: var(--accent); }

        /* Recording */
        .recording-row { display: flex; align-items: center; gap: 12px; }
        .recording-indicator {
            flex: 1; display: flex; align-items: center; gap: 10px; padding: 12px 16px;
            background-color: var(--bg-input); borderRadius: 24px;
        }
        .recording-dot {
            width: 10px; height: 10px; background-color: var(--danger); borderRadius: 50%;
            animation: pulse 1s infinite;
        }
        .recording-time { color: var(--text-primary); fontSize: 14px; fontWeight: 500; }

        .icon-btn-circle.cancel { background-color: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); }
        .icon-btn-circle.cancel:hover { background-color: var(--danger); color: white; }

        .icon-btn-circle.send-voice { background-color: var(--success); color: white; border: none; }
        .icon-btn-circle.send-voice:hover { opacity: 0.9; }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default MessageInput;
