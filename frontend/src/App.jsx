import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as chatStyles from "./styles/chatStyles";
import io from "socket.io-client";
import ReCAPTCHA from "react-google-recaptcha";

const API_URL = "/api";

function parseToken(token) {
  if (!token) return "";
  try {
    const t = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const n = decodeURIComponent(
      atob(t)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(n).username || "";
  } catch {
    return "";
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState("");
  const typingTimeoutRef = useRef(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    username: "",
    password: "",
    city: "",
    status: "",
    age: "",
  });
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalData, setProfileModalData] = useState({
    city: "",
    status: "",
    age: "",
  });
  const [registering, setRegistering] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRefChat = React.useRef(null); // для вложений в чат
  const fileInputRefAvatar = React.useRef(null); // для аватара профиля
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const [fileToSend, setFileToSend] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [modalMedia, setModalMedia] = useState(null); // {type, url, name}
  const [attachBtnHover, setAttachBtnHover] = useState(false); // Состояние для ховера кнопки вложений
  const [showCustomizer, setShowCustomizer] = useState(false); // новое состояние
  const [theme, setTheme] = useState(chatStyles.themes[0]); // выбранная тема
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const recordTimerRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const recaptchaRef = useRef(null); // добавлено

  // Функция для старта записи аудио
  const startRecording = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Ваш браузер не поддерживает запись аудио");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        setRecordTime(0);
        stream.getTracks().forEach(track => track.stop());
      };
      setMediaRecorder(recorder);
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordTime(rt => rt + 1);
      }, 1000);
      chunks = [];
      recorder.start();
    } catch (err) {
      alert("Ошибка доступа к микрофону");
    }
  };

  // Функция для остановки записи аудио
  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  // Функция для отправки аудиосообщения
  const sendAudioMessage = async () => {
    if (!audioBlob || !selectedChannel) return;
    const t = parseToken(token);
    const formData = new FormData();
    formData.append("file", audioBlob, "voice-message.webm");
    const uploadRes = await axios.post(
      `${API_URL}/upload`,
      formData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msg = {
      text: "",
      sender: t,
      channel: selectedChannel,
      fileUrl: uploadRes.data.url,
      fileType: uploadRes.data.fileType,
      originalName: uploadRes.data.originalName || "voice-message.webm"
    };
    socketRef.current && socketRef.current.emit("join", selectedChannel);
    socketRef.current.emit("message", msg);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  useEffect(() => {
    setUsername(parseToken(token));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserProfile(res.data);
        // Применяем тему из профиля
        if (res.data.theme && (res.data.theme.pageBg || res.data.theme.chatBg)) {
          const found = chatStyles.themes.find(
            t => t.pageBg === res.data.theme.pageBg && t.chatBg === res.data.theme.chatBg
          );
          setTheme(found || { ...chatStyles.themes[0], ...res.data.theme });
        } else {
          setTheme(chatStyles.themes[0]);
        }
      } catch {
        setUserProfile(null);
        setTheme(chatStyles.themes[0]);
      }
    };
    fetchProfile();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setChannels(res.data))
      .catch(() => setChannels([]));

    socketRef.current = io("/", {
      auth: { token },
    });

    socketRef.current.on("message", (msg) => {
      setMessages((prev) =>
        msg.channel === selectedChannel ? [...prev, msg] : prev
      );
    });

    socketRef.current.on("typing", (e) => {
      setTyping(`${e.user} печатает...`);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTyping(""), 2000);
    });

    // Новый обработчик: обновлять список каналов при появлении нового
    const handleNewChannel = () => {
      axios
        .get(`${API_URL}/channels`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setChannels(res.data))
        .catch(() => setChannels([]));
    };
    socketRef.current.on("new-channel", handleNewChannel);

    return () => {
      socketRef.current && socketRef.current.disconnect();
      socketRef.current && socketRef.current.off("new-channel", handleNewChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
    // eslint-disable-next-line
  }, [token]);

  useEffect(() => {
    if (token && selectedChannel) {
      axios
        .get(`${API_URL}/messages/${selectedChannel}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setMessages(res.data));
      socketRef.current && socketRef.current.emit("join", selectedChannel);
    }
  }, [token, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socketRef.current) return;
    const handler = (msg) => {
      if (msg.channel === selectedChannel) setMessages((prev) => [...prev, msg]);
    };
    socketRef.current.on("message", handler);
    return () => socketRef.current.off("message", handler);
  }, [selectedChannel]);

  const handleCreateChannel = async () => {
    if (!newChannel.trim()) return;
    try {
      const t = parseToken(token);
      const res = await axios.post(
        `${API_URL}/channels`,
        { name: newChannel, members: [t] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowCreate(false);
      setNewChannel("");
      const chs = await axios.get(`${API_URL}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChannels(chs.data);
      setSelectedChannel(res.data._id);
      socketRef.current && socketRef.current.emit("join", res.data._id);
      // socketRef.current && socketRef.current.emit("new-channel"); // УДАЛЕНО, теперь сервер сам эмитит
    } catch {
      alert("Ошибка создания канала");
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !fileToSend) || !selectedChannel) return;
    const t = parseToken(token);
    let msg = { text: input, sender: t, channel: selectedChannel };
    if (fileToSend) {
      const formData = new FormData();
      formData.append("file", fileToSend);
      const uploadRes = await axios.post(
        `${API_URL}/upload`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      msg.fileUrl = uploadRes.data.url;
      msg.fileType = uploadRes.data.fileType;
      msg.originalName = uploadRes.data.originalName;
    }
    socketRef.current && socketRef.current.emit("join", selectedChannel);
    socketRef.current.emit("message", msg);
    setInput("");
    setFileToSend(null);
    setFilePreviewUrl(null);
    if (fileInputRefChat.current) fileInputRefChat.current.value = "";
  };

  // Обработчик регистрации
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setRegistering(true);
    if (!recaptchaToken) {
      setError("Пожалуйста, подтвердите, что вы не робот");
      setRegistering(false);
      return;
    }
    try {
      await axios.post(`${API_URL}/register`, {
        username,
        password,
        recaptcha: recaptchaToken,
      });
      // После успешной регистрации получаем новый токен и логинимся автоматически
      if (recaptchaRef.current) {
        const newToken = await recaptchaRef.current.executeAsync();
        setRecaptchaToken(newToken);
        const res = await axios.post(`${API_URL}/login`, {
          username,
          password,
          recaptcha: newToken,
        });
        localStorage.setItem("token", res.data.token);
        setToken(res.data.token);
      } else {
        setError("Ошибка автоматического входа: не удалось получить reCAPTCHA");
      }
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          "Ошибка регистрации или входа"
      );
    }
    setRegistering(false);
  };

  // Обработчик входа
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setRegistering(true);
    if (!recaptchaToken) {
      setError("Пожалуйста, подтвердите, что вы не робот");
      setRegistering(false);
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/login`, {
        username,
        password,
        recaptcha: recaptchaToken,
      });
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          "Неверный логин или пароль"
      );
    }
    setRegistering(false);
  };

  // Функция для отправки изменений профиля
  const handleProfileSave = async () => {
    try {
      const payload = {
        username: editData.username,
        password: editData.password,
        city: editData.city,
        status: editData.status,
        age: editData.age,
      };
      Object.keys(payload).forEach(k => {
        if (payload[k] === "" || payload[k] === null) delete payload[k];
      });
      const res = await axios.patch(`${API_URL}/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserProfile(res.data);
      setEditMode(false);
      if (payload.username && payload.username !== userProfile.username && res.data.token) {
        localStorage.setItem("token", res.data.token);
        setToken(res.data.token);
      }
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || "Ошибка обновления профиля");
    }
  };

  const handleProfilePopupBgClick = (e) => {
    // Если клик по фону (а не по самому popup), закрываем
    setShowProfile(false);
  };

  useEffect(() => {
    if (userProfile) {
      setEditData(d => ({
        ...d,
      }));
    }
  }, [userProfile]);

  useEffect(() => {
    document.title = "ГоВЧат 2.1 Beta";
    // Добавляем/заменяем favicon
    const faviconId = "govchat-favicon";
    let link = document.querySelector(`link[rel="icon"]#${faviconId}`);
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.id = faviconId;
      document.head.appendChild(link);
    }
    // SVG-эмодзи-иконка (например, 🦆)
    link.type = "image/svg+xml";
    link.href =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="52">🦆</text></svg>';
    return () => {
      // Не удаляем favicon при размонтировании
    };
  }, []);

  // Показывать превью выбранного файла
  useEffect(() => {
    if (fileToSend) {
      if (fileToSend.type.startsWith("image/") || fileToSend.type.startsWith("video/")) {
        const url = URL.createObjectURL(fileToSend);
        setFilePreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setFilePreviewUrl(null);
      }
    } else {
      setFilePreviewUrl(null);
    }
  }, [fileToSend]);

  // Сохранение выбранной темы в профиль
  const handleThemeSelect = async (t) => {
    setTheme(t);
    setShowCustomizer(false);
    try {
      await axios.patch(`${API_URL}/profile`, { theme: { pageBg: t.pageBg, chatBg: t.chatBg } }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile((u) => u ? { ...u, theme: { pageBg: t.pageBg, chatBg: t.chatBg } } : u);
    } catch {
      // ignore
    }
  };

  // Применяем тему к стилям
  const themedPageStyle = { ...chatStyles.page, background: theme.pageBg };
  const themedChatBoxStyle = { ...chatStyles.chatBox, background: theme.chatBg };

  // Вставляем адаптивные стили в <head>
  useEffect(() => {
    const styleId = "govchat-responsive-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = chatStyles.responsive;
      document.head.appendChild(style);
    }
  }, []);

  // Для определения мобильного режима
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 700);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!token) {
    return (
      <div style={chatStyles.page}>
        <div style={chatStyles.authContainer}>
          <div style={chatStyles.authTitle}>
            {authMode === "register" ? "Регистрация" : "Вход"}
          </div>
          {error && <div style={chatStyles.error}>{error}</div>}
          <form
            onSubmit={authMode === "register" ? handleRegister : handleLogin}
            style={{ width: "100%" }}
          >
            <input
              style={chatStyles.authInput}
              placeholder="Имя"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              style={chatStyles.authInput}
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {/* reCAPTCHA */}
            <div style={{ margin: "12px 0", display: "flex", justifyContent: "center" }}>
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey="6Lddfm0rAAAAAGiUK6xobnuL-5YsdM3eFWbykEB9"
                onChange={token => setRecaptchaToken(token)}
                onExpired={() => setRecaptchaToken("")}
                key={authMode}
                size="normal" // обязательно не "invisible", иначе не будет видно пользователю
              />
            </div>
            <button
              style={chatStyles.authBtn}
              type="submit"
              disabled={registering || !recaptchaToken}
            >
              {authMode === "register" ? "Зарегистрироваться" : "Войти"}
            </button>
          </form>
          <button
            style={chatStyles.switchBtn}
            type="button"
            onClick={() => {
              setAuthMode(authMode === "register" ? "login" : "register");
              setError("");
              setRecaptchaToken("");
              setUsername("");
              setPassword("");
            }}
          >
            {authMode === "register" ? "Войти" : "Регистрация"}
          </button>
        </div>
      </div>
    );
  }

  // --- Мобильный header ---
  const mobileHeader = (
    <div style={chatStyles.mobileHeader} className="govchat-mobile-header">
      <button
        style={chatStyles.mobileMenuBtn}
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Меню"
      >
        <span style={{ fontSize: 28 }}>☰</span>
      </button>
      <div style={{
        fontWeight: 700,
        fontSize: 20,
        color: "#00c3ff",
        letterSpacing: 1,
        textShadow: "0 2px 8px #0002",
        margin: "0 auto",
      }}>
        ГоВЧат 2.1 Beta
      </div>
    </div>
  );

  // --- Мобильное меню ---
  const mobileMenu = (
    <div style={chatStyles.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
      <div
        style={chatStyles.mobileMenu}
        onClick={e => e.stopPropagation()}
      >
        <button
          style={chatStyles.mobileMenuCloseBtn}
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Закрыть"
        >✕</button>
        <div style={chatStyles.mobileMenuTitle}>Каналы</div>
        <div style={chatStyles.mobileMenuChannels}>
          {channels.length === 0 ? (
            <div style={{ color: "#b2bec3", marginBottom: 8 }}>
              Нет доступных каналов
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch._id}
                style={chatStyles.channelItem(selectedChannel === ch._id)}
                onClick={() => {
                  setSelectedChannel(ch._id);
                  setMobileMenuOpen(false);
                }}
              >
                {ch.name}
              </div>
            ))
          )}
          <button
            style={chatStyles.createBtn}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Скрыть создание" : "Создать канал"}
          </button>
          {showCreate && (
            <div style={{ marginTop: 10 }}>
              <input
                style={chatStyles.input}
                placeholder="Название канала"
                value={newChannel}
                onChange={e => setNewChannel(e.target.value)}
              />
              <button style={chatStyles.createBtn} onClick={handleCreateChannel}>
                Создать
              </button>
            </div>
          )}
        </div>
        {/* Кнопки профиля и кастомизации теперь после списка каналов */}
        <div
          className="govchat-mobile-profile-actions"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            margin: "18px 0 16px 0",
          }}
        >
          {/* Профиль */}
          <button
            style={{
              ...chatStyles.profileBtn,
              width: 48,
              height: 48,
              fontSize: 24,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={() => {
              setShowProfile(true);
              setMobileMenuOpen(false);
              setEditMode(false);
            }}
            title="Профиль"
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="13" fill="#00c3ff" />
              <circle cx="13" cy="10" r="4" fill="#fff" />
              <ellipse cx="13" cy="19" rx="7" ry="4" fill="#fff" />
            </svg>
          </button>
          {/* Кастомизация */}
          <button
            style={{
              ...chatStyles.profileBtn,
              width: 48,
              height: 48,
              fontSize: 24,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              marginRight: 0,
              marginLeft: 0,
              boxShadow: "0 2px 8px #00c3ff33"
            }}
            onClick={() => {
              setShowCustomizer(true);
              setMobileMenuOpen(false);
            }}
            title="Кастомизация"
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="13" fill="#ffb347" />
              <path d="M7 19c0-2 2-4 4-4s4 2 4 4" stroke="#fff" strokeWidth="2" />
              <rect x="10" y="6" width="6" height="8" rx="2" fill="#fff" stroke="#ffb347" strokeWidth="1.5"/>
              <rect x="8" y="14" width="10" height="4" rx="2" fill="#ffb347" stroke="#fff" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
        <div style={chatStyles.mobileMenuFooter}>
          {/* Кнопка "Выйти" убрана из мобильного меню */}
        </div>
      </div>
    </div>
  );

  return (
    <div style={themedPageStyle} className="govchat-page">
      {/* Мобильный header */}
      {isMobile && mobileHeader}
      {/* Мобильное меню */}
      {isMobile && mobileMenuOpen && mobileMenu}
      {/* Сайдбар только на десктопе */}
      {!isMobile && (
        <div style={chatStyles.sidebar} className="govchat-sidebar">
          <div style={chatStyles.sidebarTitle}>ГоВЧат 2.1 Beta</div>
          <div style={chatStyles.channelList} className="govchat-channel-list">
            <div style={{ fontWeight: 600, color: "#fff", marginBottom: 10 }}>Каналы</div>
            {channels.length === 0 ? (
              <div style={{ color: "#b2bec3", marginBottom: 8 }}>
                Нет доступных каналов
              </div>
            ) : (
              <>
                {channels.map((ch) => (
                  <div
                    key={ch._id}
                    style={chatStyles.channelItem(selectedChannel === ch._id)}
                    onClick={() => setSelectedChannel(ch._id)}
                  >
                    {ch.name}
                  </div>
                ))}
              </>
            )}
            <button
              style={chatStyles.createBtn}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Скрыть создание" : "Создать канал"}
            </button>
            {showCreate && (
              <div style={{ marginTop: 10 }}>
                <input
                  style={chatStyles.input}
                  placeholder="Название канала"
                  value={newChannel}
                  onChange={e => setNewChannel(e.target.value)}
                />
                <button style={chatStyles.createBtn} onClick={handleCreateChannel}>
                  Создать
                </button>
              </div>
            )}
          </div>
          {/* --- Кнопки профиля и кастомизации для десктопа --- */}
          <div style={{
            ...chatStyles.profileBtnBox,
            left: "auto",
            right: 178,
            bottom: 70,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            zIndex: 10
          }}>
            {/* Кнопка профиля */}
            <button
              style={chatStyles.profileBtn}
              onClick={() => {
                setShowProfile(v => !v);
                setEditMode(false);
              }}
              title="Профиль"
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="13" fill="#00c3ff" />
                <circle cx="13" cy="10" r="4" fill="#fff" />
                <ellipse cx="13" cy="19" rx="7" ry="4" fill="#fff" />
              </svg>
            </button>
            {/* Кнопка кастомизации */}
            <button
              style={{
                ...chatStyles.profileBtn,
                background: "none",
                border: "none",
                marginRight: 0,
                marginLeft: 0,
                boxShadow: "0 2px 8px #00c3ff33"
              }}
              onClick={() => setShowCustomizer(v => !v)}
              title="Кастомизация"
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="13" fill="#ffb347" />
                <path d="M7 19c0-2 2-4 4-4s4 2 4 4" stroke="#fff" strokeWidth="2" />
                <rect x="10" y="6" width="6" height="8" rx="2" fill="#fff" stroke="#ffb347" strokeWidth="1.5"/>
                <rect x="8" y="14" width="10" height="4" rx="2" fill="#ffb347" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Чат всегда на экране, но с отступом сверху на мобиле */}
      <div
        style={{
          ...chatStyles.chatContainer,
          ...(isMobile
            ? {
                paddingTop: 40, // уменьшено с 64 до 40
                height: "calc(100vh - 40px)", // уменьшить высоту чата на мобильном
                maxHeight: "calc(100vh - 40px)",
              }
            : {}),
        }}
        className="govchat-chat-container"
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginBottom: 10,
          minHeight: 32,
          marginTop: isMobile ? 18 : 0 // добавлено для мобильных
        }}>
          <div style={chatStyles.chatTitle}>Чат</div>
        </div>
        <div
          className="govchat-chat-box"
          style={themedChatBoxStyle}
        >
          {messages.map((msg) => {
            const isMine = msg.sender === username;
            // Формат времени
            const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={msg._id} style={chatStyles.messageRow(isMine)}>
                <div style={chatStyles.message(isMine)}>
                  {/* Только для чужих сообщений показываем имя */}
                  {!isMine && (
                    <span style={chatStyles.messageSender}>
                      {msg.sender}:
                    </span>
                  )}
                  {msg.text}
                  {/* Превью файлов */}
                  {msg.fileUrl && msg.fileType && (
                    <span style={{ display: "block", marginTop: 8 }}>
                      {msg.fileType.startsWith("audio/") ? (
                        <audio src={msg.fileUrl} controls style={{ maxWidth: 220, borderRadius: 8, background: "#232526" }} />
                      ) : msg.fileType.startsWith("image/") ? (
                        <img
                          src={msg.fileUrl}
                          alt={msg.originalName || "image"}
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 8px #00c3ff33" }}
                          onClick={() => setModalMedia({ type: "image", url: msg.fileUrl, name: msg.originalName })}
                        />
                      ) : msg.fileType.startsWith("video/") ? (
                        <video
                          src={msg.fileUrl}
                          controls={false}
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 8px #00c3ff33" }}
                          onClick={() => setModalMedia({ type: "video", url: msg.fileUrl, name: msg.originalName })}
                        >
                          Ваш браузер не поддерживает видео.
                        </video>
                      ) : (
                        // Превью для документов
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            background: "#232526",
                            borderRadius: 8,
                            padding: "8px 12px",
                            boxShadow: "0 2px 8px #00c3ff22",
                            maxWidth: 220,
                            minWidth: 0,
                            color: "#fff"
                          }}
                          onClick={() => {
                            // Определяем тип документа для предпросмотра
                            const ext = (msg.originalName || "").split('.').pop().toLowerCase();
                            if (msg.fileType === "application/pdf") {
                              setModalMedia({ type: "pdf", url: msg.fileUrl, name: msg.originalName });
                            } else {
                              setModalMedia({ type: "doc", url: msg.fileUrl, name: msg.originalName, ext });
                            }
                          }}
                          title={msg.originalName}
                        >
                          {/* Иконка документа по расширению */}
                          <span style={{ fontSize: 28 }}>
                            {(() => {
                              const ext = (msg.originalName || "").split('.').pop().toLowerCase();
                              if (ext === "pdf") return "📄";
                              if (["doc", "docx"].includes(ext)) return "📝";
                              if (["xls", "xlsx"].includes(ext)) return "📊";
                              if (["ppt", "pptx"].includes(ext)) return "📈";
                              if (["txt", "rtf"].includes(ext)) return "📃";
                              return "📁";
                            })()}
                          </span>
                          <span style={{
                            fontSize: 14,
                            color: "#fff",
                            wordBreak: "break-all",
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {msg.originalName}
                          </span>
                        </span>
                      )}
                      {/* Кнопка скачать убрана отсюда */}
                    </span>
                  )}
                  {/* Время сообщения под текстом, меньшим шрифтом */}
                  <div style={{ color: "#b2bec3", fontSize: 11, marginTop: 4, textAlign: isMine ? "right" : "left" }}>
                    {time}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {/* typing вынесен в отдельный flex-контейнер над inputRow */}
        <div style={{ minHeight: 22, display: "flex", alignItems: "flex-end", marginBottom: 2 }}>
          {typing && (
            <div style={{
              ...chatStyles.typing,
              margin: 0,
              paddingLeft: 8,
              paddingRight: 8,
              background: "none",
              borderRadius: 0,
              position: "relative",
              zIndex: 2,
              width: "fit-content",
              maxWidth: "80%",
              alignSelf: "flex-start",
              boxShadow: "none"
            }}>
              {typing}
            </div>
          )}
        </div>
        {/* Превью выбранного файла теперь над inputRow */}
        {fileToSend && (
          <div style={{
            margin: "0 0 8px 0",
            padding: "6px 10px",
            background: "#35363a",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 320
          }}>
            {fileToSend.type.startsWith("image/") && filePreviewUrl && (
              <img src={filePreviewUrl} alt="preview" style={{ maxWidth: 48, maxHeight: 48, borderRadius: 6 }} />
            )}
            {fileToSend.type.startsWith("video/") && filePreviewUrl && (
              <video src={filePreviewUrl} style={{ maxWidth: 48, maxHeight: 48, borderRadius: 6 }} controls />
            )}
            {!fileToSend.type.startsWith("image/") && !fileToSend.type.startsWith("video/") && (
              <span role="img" aria-label="file">📎</span>
            )}
            <span style={{ color: "#fff", fontSize: 14, wordBreak: "break-all" }}>{fileToSend.name}</span>
            <button
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "#ff7675",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer"
              }}
              title="Удалить файл"
              onClick={() => {
                setFileToSend(null);
                setFilePreviewUrl(null);
                if (fileInputRefChat.current) fileInputRefChat.current.value = "";
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* --- Мобильная и десктопная строка ввода --- */}
        <div
          style={{
            ...chatStyles.inputRow,
            ...(isMobile ? { padding: "6px 2vw 6px 2vw" } : {}),
          }}
          className="govchat-input-row"
        >
          {/* Кнопка вложения */}
          <button
            style={{
              ...(attachBtnHover
                ? { ...chatStyles.attachBtn, ...chatStyles.attachBtnHover }
                : chatStyles.attachBtn),
              ...(isMobile
                ? {
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    fontSize: 18,
                    marginRight: 2,
                  }
                : {}),
            }}
            type="button"
            onClick={() => fileInputRefChat.current && fileInputRefChat.current.click()}
            title="Прикрепить файл"
            tabIndex={-1}
            onMouseEnter={() => setAttachBtnHover(true)}
            onMouseLeave={() => setAttachBtnHover(false)}
            disabled={false}
          >
            <span style={{
              color: "#222",
              fontSize: isMobile ? 18 : 22,
              display: "flex",
              alignItems: "center"
            }}>📎</span>
          </button>
          <input
            ref={fileInputRefChat}
            type="file"
            style={{ display: "none" }}
            onChange={e => {
              if (e.target.files?.[0]) setFileToSend(e.target.files[0]);
            }}
          />
          {/* Кнопка записи голосового (всегда показывать, уменьшить на мобиле) */}
          <button
            style={{
              ...chatStyles.attachBtn,
              background: recording ? "#ff7675" : "#fff",
              color: recording ? "#fff" : "#222",
              marginRight: 2,
              marginLeft: 0,
              border: recording ? "2px solid #ff7675" : "none",
              ...(isMobile
                ? {
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    fontSize: 18,
                  }
                : {}),
            }}
            type="button"
            onClick={() => {
              if (!recording) startRecording();
              else stopRecording();
            }}
            title={recording ? "Остановить запись" : "Записать голосовое"}
            disabled={fileToSend || audioBlob}
          >
            {recording ? (
              <span style={{
                color: "#fff",
                fontSize: isMobile ? 18 : 22,
                display: "flex",
                alignItems: "center"
              }}>⏺</span>
            ) : (
              <span style={{
                color: "#222",
                fontSize: isMobile ? 18 : 22,
                display: "flex",
                alignItems: "center"
              }}>🎤</span>
            )}
          </button>
          {/* Отображение времени записи */}
          {recording && (
            <span style={{
              color: "#ff7675",
              fontWeight: 600,
              minWidth: isMobile ? 28 : 40,
              fontSize: isMobile ? 13 : 16,
            }}>
              {`${Math.floor(recordTime / 60)
                .toString()
                .padStart(2, "0")}:${(recordTime % 60).toString().padStart(2, "0")}`}
            </span>
          )}
          {/* Поле ввода */}
          <input
            style={{
              ...chatStyles.input,
              ...(isMobile ? { fontSize: 14, padding: "8px 10px" } : {}),
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (selectedChannel) {
                socketRef.current.emit("typing", { channel: selectedChannel });
                if (e.key === "Enter") handleSend();
              }
            }}
            disabled={!selectedChannel}
            placeholder={
              selectedChannel
                ? "Введите сообщение..."
                : "Выберите канал"
            }
          />
          {/* Кнопка отправки */}
          <button
            style={{
              ...(isMobile
                ? {
                    background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    padding: 0,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px #00c3ff33",
                    marginLeft: 2,
                  }
                : chatStyles.sendBtn),
            }}
            onClick={handleSend}
            disabled={!selectedChannel || (!input.trim() && !fileToSend)}
            title="Отправить"
          >
            {isMobile
              ? <span style={{ fontSize: 18, color: "#fff" }}>➤</span>
              : "Отправить"}
          </button>
          {/* Отображение превью аудиосообщения */}
          {audioBlob && audioUrl && (
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginRight: isMobile ? 2 : 8
            }}>
              <audio src={audioUrl} controls style={{ height: isMobile ? 24 : 32 }} />
              <button
                style={{
                  background: "#ff7675",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: isMobile ? "4px 8px" : "6px 12px",
                  fontWeight: 600,
                  fontSize: isMobile ? 12 : 14,
                  cursor: "pointer",
                  marginLeft: 4
                }}
                onClick={sendAudioMessage}
                title="Отправить голосовое"
              >
                {isMobile ? <span>➤</span> : "Отправить"}
              </button>
              <button
                style={{
                  background: "none",
                  color: "#ff7675",
                  border: "none",
                  fontWeight: 700,
                  fontSize: isMobile ? 14 : 16,
                  cursor: "pointer"
                }}
                title="Удалить запись"
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                }}
              >
                ✕
              </button>
            </span>
          )}
        </div>
        {/* Модальное окно для просмотра фото/видео */}
        {modalMedia && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.7)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={() => setModalMedia(null)}
          >
            <div
              style={{
                background: "#232526",
                borderRadius: 12,
                padding: 24,
                maxWidth: "90vw",
                maxHeight: "90vh",
                boxShadow: "0 4px 32px #000a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative"
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 700,
                  cursor: "pointer",
                  zIndex: 2
                }}
                onClick={() => setModalMedia(null)}
                title="Закрыть"
              >✕</button>
              {modalMedia.type === "image" ? (
                <>
                  <img
                    src={modalMedia.url}
                    alt={modalMedia.name}
                    style={{ maxWidth: "70vw", maxHeight: "70vh", borderRadius: 10, marginBottom: 16 }}
                  />
                  {/* Название изображения над кнопкой скачать */}
                  {modalMedia.name && (
                    <div style={{
                      color: "#fff",
                      fontSize: 16,
                      marginBottom: 16,
                      wordBreak: "break-all",
                      textAlign: "center",
                      maxWidth: "60vw"
                    }}>
                      {modalMedia.name}
                    </div>
                  )}
                </>
              ) : modalMedia.type === "video" ? (
                <video
                  src={modalMedia.url}
                  controls
                  autoPlay
                  style={{ maxWidth: "70vw", maxHeight: "70vh", borderRadius: 10, marginBottom: 16, background: "#000" }}
                />
              ) : modalMedia.type === "pdf" ? (
                <iframe
                  src={modalMedia.url}
                  title={modalMedia.name}
                  style={{
                    width: "70vw",
                    height: "70vh",
                    border: "none",
                    borderRadius: 10,
                    background: "#fff",
                    marginBottom: 16
                  }}
                />
              ) : modalMedia.type === "doc" ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 200,
                  minWidth: 200,
                  marginBottom: 16
                }}>
                  <span style={{ fontSize: 64, marginBottom: 16 }}>
                    {(() => {
                      const ext = (modalMedia.ext || "").toLowerCase();
                      if (ext === "pdf") return "📄";
                      if (["doc", "docx"].includes(ext)) return "📝";
                      if (["xls", "xlsx"].includes(ext)) return "📊";
                      if (["ppt", "pptx"].includes(ext)) return "📈";
                      if (["txt", "rtf"].includes(ext)) return "📃";
                      return "📁";
                    })()}
                  </span>
                  <div style={{ color: "#fff", fontSize: 18, marginBottom: 8, wordBreak: "break-all", textAlign: "center" }}>
                    {modalMedia.name}
                  </div>
                  <div style={{ color: "#b2bec3", fontSize: 15, marginBottom: 18 }}>
                    Предпросмотр недоступен для этого типа файла
                  </div>
                </div>
              ) : null}
              <button
                style={{
                  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #00c3ff33",
                  textDecoration: "none"
                }}
                onClick={async e => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(modalMedia.url, { credentials: "same-origin" });
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = modalMedia.name || "file";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      window.URL.revokeObjectURL(url);
                      a.remove();
                    }, 200);
                  } catch (err) {
                    alert("Ошибка скачивания файла");
                  }
                }}
              >
                Скачать
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Модальное окно профиля */}
      {showProfile && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.12)",
            zIndex: 99,
            transition: "background 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={handleProfilePopupBgClick}
        >
          <div
            style={{
              ...chatStyles.profilePopup,
              ...(isMobile
                ? {
                    // Центрируем и делаем окно меньше на мобильных
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "90vw",
                    maxWidth: 340,
                    minWidth: 0,
                    height: "auto",
                    maxHeight: "70vh",
                    minHeight: 320,
                    borderRadius: 16,
                    padding: "16px 8px 8px 8px",
                    boxShadow: "0 2px 16px #00c3ff33",
                    fontSize: 15,
                    display: "flex",
                    flexDirection: "column",
                  }
                : {
                    transform: showProfile ? "translateY(0)" : "translateY(120%)",
                    opacity: showProfile ? 1 : 0,
                    pointerEvents: showProfile ? "auto" : "none",
                  }),
              transition: "transform 0.32s cubic-bezier(.4,1.4,.6,1), opacity 0.22s",
              justifyContent: "flex-start",
            }}
            className="govchat-profile-popup"
            onClick={e => e.stopPropagation()}
          >
            {/* Фиксированная шапка для мобильного */}
            {isMobile && (
              <div style={{
                position: "sticky",
                top: 0,
                left: 0,
                width: "100%",
                background: "#232526",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px 0 0",
                minHeight: 36,
                marginBottom: 8
              }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#00c3ff", flex: 1, textAlign: "center" }}>Профиль</div>
                {/* Крестик справа сверху */}
                <button
                  style={{
                    ...chatStyles.profileCloseBtn,
                    position: "static",
                    right: 0,
                    top: 0,
                    width: 32,
                    height: 32,
                    fontSize: 22,
                    marginRight: 4,
                    marginTop: 0,
                    marginBottom: 0,
                    background: "none",
                    color: "#b2bec3",
                    boxShadow: "none",
                  }}
                  onClick={() => setShowProfile(false)}
                  title="Закрыть"
                >✕</button>
              </div>
            )}
            {/* Новый аватар/значок профиля */}
            <div
              style={{
                ...chatStyles.profileAvatar,
                ...(isMobile
                  ? { width: 70, height: 70, margin: "8px auto 8px auto", fontSize: 36 }
                  : {}),
              }}
              className="govchat-profile-avatar"
            >
              <div
                style={{
                  position: "relative",
                  width: isMobile ? 70 : 90,
                  height: isMobile ? 70 : 90,
                  borderRadius: "50%",
                  overflow: "hidden",
                  cursor: "pointer",
                  border: "2px solid #00c3ff",
                  margin: "0 auto",
                  background: "#35363a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => fileInputRefAvatar.current && fileInputRefAvatar.current.click()}
                title="Изменить фото"
              >
                {/* Показываем пользовательский аватар только если он есть и не дефолтный */}
                {userProfile?.avatarUrl &&
                  userProfile.avatarUrl !== "/uploads/avatar-default.png" ? (
                  <img
                    key={userProfile.avatarUrl + avatarVersion}
                    src={
                      userProfile.avatarUrl
                        ? userProfile.avatarUrl + "?t=" + avatarVersion
                        : "/uploads/avatar-default.png"
                    }
                    alt="avatar"
                    style={{
                      width: isMobile ? 70 : 90,
                      height: isMobile ? 70 : 90,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src =
                        `${window.location.protocol}//${window.location.hostname}:5000/uploads/avatar-default.png`;
                    }}
                  />
                ) : (
                  // Показываем дефолтную картинку, если нет пользовательской
                  <img
                    src={"/uploads/avatar-default.png"}
                    alt="avatar"
                    style={{
                      width: isMobile ? 70 : 90,
                      height: isMobile ? 70 : 90,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src =
                        "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(userProfile?.username || "U") +
                        "&background=00c3ff&color=fff&size=90";
                    }}
                  />
                )}
                <input
                  ref={fileInputRefAvatar}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async e => {
                    if (!e.target.files?.[0]) return;
                    const formData = new FormData();
                    formData.append("file", e.target.files[0]);
                    const uploadRes = await axios.post(
                      `${API_URL}/upload?avatar=1`,
                      formData,
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    await axios.patch(
                      `${API_URL}/profile`,
                      { avatarUrl: uploadRes.data.url },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const profileRes = await axios.get(`${API_URL}/profile`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setUserProfile(profileRes.data);
                    setAvatarVersion(Date.now());
                  }}
                />
              </div>
            </div>
            {/* Содержимое профиля с прокруткой */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              marginBottom: 10,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              ...(isMobile ? { padding: "0 4px" } : {})
            }}>
              {userProfile && !editMode && (
                <>
                  {!isMobile && (
                    <div style={chatStyles.profileTitle} className="govchat-profile-title">Профиль</div>
                  )}
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Ник:</span> {userProfile.username}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Возраст:</span> {userProfile.age ?? "—"}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Город:</span> {userProfile.city ?? "—"}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Семейный статус:</span> {userProfile.status ?? "—"}
                  </div>
                  {/* Кнопки теперь внутри скроллируемой области, сразу после информации */}
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 18,
                    justifyContent: "flex-end",
                    flexWrap: isMobile ? "wrap" : "nowrap"
                  }}>
                    <button
                      style={{
                        ...chatStyles.profileEditBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={() => {
                        setEditData({
                          username: userProfile.username || "",
                          password: "",
                          city: userProfile.city || "",
                          status: userProfile.status || "",
                          age: userProfile.age || "",
                        });
                        setEditMode(true);
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      style={{
                        ...chatStyles.profileLogoutBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={() => {
                        localStorage.removeItem("token");
                        window.location.reload();
                      }}
                    >
                      Выйти
                    </button>
                  </div>
                </>
              )}
              {userProfile && editMode && (
                <>
                  {!isMobile && (
                    <div style={chatStyles.profileTitle}>Редактирование профиля</div>
                  )}
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Ник:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.username}
                      onChange={e => setEditData(d => ({ ...d, username: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Пароль:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      type="password"
                      value={editData.password}
                      placeholder="Новый пароль"
                      onChange={e => setEditData(d => ({ ...d, password: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Возраст:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      type="number"
                      min={0}
                      value={editData.age}
                      onChange={e => setEditData(d => ({ ...d, age: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Город:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.city}
                      onChange={e => setEditData(d => ({ ...d, city: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Семейный статус:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.status}
                      onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                    />
                  </div>
                  {/* Кнопки теперь внутри скроллируемой области, сразу после полей */}
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    justifyContent: "flex-end",
                    flexWrap: isMobile ? "wrap" : "nowrap"
                  }}>
                    <button
                      style={{
                        ...chatStyles.profileEditBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={handleProfileSave}
                    >
                      Сохранить
                    </button>
                    <button
                      style={{
                        ...chatStyles.profileCloseBtn,
                        position: "static",
                        width: "auto",
                        height: "auto",
                        fontSize: isMobile ? 14 : 15,
                        marginLeft: 0,
                        marginTop: 0,
                        marginBottom: 0,
                        background: "#35363a",
                        color: "#b2bec3",
                        boxShadow: "0 2px 8px #0002",
                        ...(isMobile ? { padding: "7px 12px" } : {})
                      }}
                      onClick={() => setEditMode(false)}
                    >
                      Отмена
                    </button>
                  </div>
                </>
              )}
              {!userProfile && (
                <div style={{ color: "#b2bec3", marginBottom: 8 }}>Загрузка...</div>
              )}
            </div>
            {/* Кнопки убраны из нижней части popup */}
          </div>
        </div>
      )}
      {/* Модальное окно кастомизации */}
      {showCustomizer && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.12)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={() => setShowCustomizer(false)}
        >
          <div
            style={{
              background: "#232526",
              borderRadius: 16,
              boxShadow: "0 2px 16px #00c3ff33",
              padding: "32px 32px 24px 32px",
              minWidth: 320,
              maxWidth: 420,
              zIndex: 121,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative"
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{
                position: "absolute",
                top: 10,
                right: 16,
                background: "none",
                color: "#b2bec3",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                fontSize: 22,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s, color 0.2s",
                zIndex: 122,
              }}
              onClick={() => setShowCustomizer(false)}
              title="Закрыть"
            >✕</button>
            <div style={{ fontWeight: 700, fontSize: 20, color: "#ffb347", marginBottom: 18 }}>
              Кастомизация оформления
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
              {chatStyles.themes.map((t, idx) => (
                <button
                  key={t.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    background: t.pageBg,
                    border: theme.name === t.name ? "2px solid #00c3ff" : "2px solid transparent",
                    borderRadius: 10,
                    padding: "12px 18px",
                    cursor: "pointer",
                    color: "#222",
                    fontWeight: 600,
                    fontSize: 16,
                    boxShadow: theme.name === t.name ? "0 2px 12px #00c3ff44" : "0 2px 8px #0002",
                    transition: "border 0.2s, box-shadow 0.2s"
                  }}
                  onClick={() => handleThemeSelect(t)}
                >
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: t.chatBg,
                    border: "1.5px solid #fff", display: "inline-block", marginRight: 8
                  }} />
                  <span style={{ color: "#fff", textShadow: "0 1px 4px #0005" }}>{t.name}</span>
                  {theme.name === t.name && (
                    <span style={{ marginLeft: "auto", color: "#00c3ff", fontSize: 22 }}>✔</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;