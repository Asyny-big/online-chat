import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function MessageInput({ chatId, socket, token, onTyping }) {
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

    socket.emit('message:send', {
      chatId,
      text: input.trim(),
      type: 'text'
    });

    setInput('');
    socket.emit('typing:stop', { chatId });
  };

  // === ФАЙЛЫ ===
  const handleFileSelect = () => fileInputRef.current?.click();

  const uploadFile = async (file) => {
    if (!file || !chatId) return;
    
    // Лимит 20 МБ
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

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const type = isImage ? 'image' : isVideo ? 'video' : 'file';

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
      style={{
        ...styles.container,
        ...(isDragging ? styles.dragging : {})
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={styles.dropOverlay}>
          <span style={styles.dropText}>📎 Отпустите для загрузки</span>
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
        <div style={styles.recordingRow}>
          <div style={styles.recordingIndicator}>
            <span style={styles.recordingDot} />
            <span style={styles.recordingTime}>{formatTime(recordingTime)}</span>
          </div>
          <button onClick={cancelRecording} style={styles.cancelBtn} title="Отмена">
            ✕
          </button>
          <button onClick={stopRecording} style={styles.sendVoiceBtn} title="Отправить">
            ➤
          </button>
        </div>
      ) : (
        // Обычный режим
        <form onSubmit={handleSend} style={styles.form}>
          <button
            type="button"
            onClick={handleFileSelect}
            style={styles.iconBtn}
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
            style={styles.input}
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
              style={{
                ...styles.sendBtn,
                ...(canSend ? {} : styles.sendBtnDisabled)
              }}
              disabled={!canSend}
            >
              ➤
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              style={styles.micBtn}
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

const styles = {
  container: {
    padding: '14px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
    backdropFilter: 'blur(20px) saturate(180%)',
    position: 'relative',
    boxShadow: '0 -2px 16px rgba(0,0,0,0.1)',
  },
  dragging: {
    background: '#1e40af',
  },
  dropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(30, 64, 175, 0.9)',
    borderRadius: '8px',
    zIndex: 10,
  },
  dropText: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '14px 18px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '28px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  iconBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '50%',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none',
    borderRadius: '50%',
    fontSize: '18px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  sendBtnDisabled: {
    background: '#334155',
    cursor: 'not-allowed',
  },
  micBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none',
    borderRadius: '50%',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  // Запись
  recordingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  recordingIndicator: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: '#0f172a',
    borderRadius: '24px',
  },
  recordingDot: {
    width: '10px',
    height: '10px',
    background: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  },
  recordingTime: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
  },
  cancelBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ef4444',
    border: 'none',
    borderRadius: '50%',
    fontSize: '16px',
    color: '#fff',
    cursor: 'pointer',
  },
  sendVoiceBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#22c55e',
    border: 'none',
    borderRadius: '50%',
    fontSize: '16px',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default MessageInput;
