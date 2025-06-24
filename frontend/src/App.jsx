import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as chatStyles from "./styles/chatStyles";
import io from "socket.io-client";

const API_URL = "http://localhost:5000/api";

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
  const fileInputRef = React.useRef(null);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const [fileToSend, setFileToSend] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [modalMedia, setModalMedia] = useState(null); // {type, url, name}
  const [attachBtnHover, setAttachBtnHover] = useState(false); // Состояние для ховера кнопки вложений

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
      } catch {
        setUserProfile(null);
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

    socketRef.current = io("http://localhost:5000", {
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

    const handleNewChannel = () => window.location.reload();
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
      socketRef.current && socketRef.current.emit("new-channel");
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
      msg.fileUrl = uploadRes.data.url.startsWith("http")
        ? uploadRes.data.url
        : `${window.location.protocol}//${window.location.hostname}:5000${uploadRes.data.url}`;
      msg.fileType = uploadRes.data.fileType;
      // Используем оригинальное имя пользователя, а не имя файла на сервере
      msg.originalName = uploadRes.data.originalName;
    }
    socketRef.current && socketRef.current.emit("join", selectedChannel);
    socketRef.current.emit("message", msg);
    setInput("");
    setFileToSend(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Обработчик регистрации
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setRegistering(true);
    try {
      await axios.post(`${API_URL}/register`, {
        username,
        password,
      });
      // После успешной регистрации сразу логиним
      const res = await axios.post(`${API_URL}/login`, {
        username,
        password,
      });
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          "Ошибка регистрации или логина"
      );
    }
    setRegistering(false);
  };

  // Обработчик входа
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setRegistering(true);
    try {
      const res = await axios.post(`${API_URL}/login`, {
        username,
        password,
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
            <button
              style={chatStyles.authBtn}
              type="submit"
              disabled={registering}
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
            }}
          >
            {authMode === "register" ? "Войти" : "Регистрация"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={chatStyles.page}>
      <div style={chatStyles.sidebar}>
        <div style={chatStyles.sidebarTitle}>ГоВЧат 2.1 Beta</div>
        <div style={chatStyles.channelList}>
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
        <div style={{ flex: 1 }} />
        <div style={chatStyles.profileBtnBox}>
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
              }}
              onClick={handleProfilePopupBgClick}
            >
              <div
                style={{
                  ...chatStyles.profilePopup,
                  transform: showProfile ? "translateY(0)" : "translateY(120%)",
                  opacity: showProfile ? 1 : 0,
                  pointerEvents: showProfile ? "auto" : "none",
                  transition: "transform 0.32s cubic-bezier(.4,1.4,.6,1), opacity 0.22s",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Новый аватар/значок профиля */}
                <div style={chatStyles.profileAvatar}>
                  <div
                    style={{
                      position: "relative",
                      width: 90,
                      height: 90,
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
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title="Изменить фото"
                  >
                    {/* Показываем пользовательский аватар только если он есть и не дефолтный */}
                    {userProfile?.avatarUrl &&
                      userProfile.avatarUrl !== "/uploads/avatar-default.png" ? (
                      <img
                        key={userProfile.avatarUrl + avatarVersion}
                        src={
                          userProfile.avatarUrl.startsWith("http")
                            ? userProfile.avatarUrl + "?t=" + avatarVersion
                            : `${window.location.protocol}//${window.location.hostname}:5000${userProfile.avatarUrl}?t=${avatarVersion}`
                        }
                        alt="avatar"
                        style={{
                          width: 90,
                          height: 90,
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
                        src={`${window.location.protocol}//${window.location.hostname}:5000/uploads/avatar-default.png`}
                        alt="avatar"
                        style={{
                          width: 90,
                          height: 90,
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
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async e => {
                        if (!e.target.files?.[0]) return;
                        const formData = new FormData();
                        formData.append("file", e.target.files[0]);
                        // Получаем абсолютный URL для аватара
                        const uploadRes = await axios.post(
                          `${API_URL}/upload?avatar=1`,
                          formData,
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                        // Принудительно обновляем avatarUrl в профиле (патчим профиль)
                        await axios.patch(
                          `${API_URL}/profile`,
                          { avatarUrl: uploadRes.data.url },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        // Получаем свежий профиль
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
                  justifyContent: "flex-start"
                }}>
                  {userProfile && !editMode && (
                    <>
                      <div style={chatStyles.profileTitle}>Профиль</div>
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
                      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
                        <button
                          style={chatStyles.profileEditBtn}
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
                          style={chatStyles.profileLogoutBtn}
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
                      <div style={chatStyles.profileTitle}>Редактирование профиля</div>
                      <div style={chatStyles.profileField}>
                        <span style={chatStyles.profileLabel}>Ник:</span>
                        <input
                          style={chatStyles.profileInput}
                          value={editData.username}
                          onChange={e => setEditData(d => ({ ...d, username: e.target.value }))}
                        />
                      </div>
                      <div style={chatStyles.profileField}>
                        <span style={chatStyles.profileLabel}>Пароль:</span>
                        <input
                          style={chatStyles.profileInput}
                          type="password"
                          value={editData.password}
                          placeholder="Новый пароль"
                          onChange={e => setEditData(d => ({ ...d, password: e.target.value }))}
                        />
                      </div>
                      <div style={chatStyles.profileField}>
                        <span style={chatStyles.profileLabel}>Возраст:</span>
                        <input
                          style={chatStyles.profileInput}
                          type="number"
                          min={0}
                          value={editData.age}
                          onChange={e => setEditData(d => ({ ...d, age: e.target.value }))}
                        />
                      </div>
                      <div style={chatStyles.profileField}>
                        <span style={chatStyles.profileLabel}>Город:</span>
                        <input
                          style={chatStyles.profileInput}
                          value={editData.city}
                          onChange={e => setEditData(d => ({ ...d, city: e.target.value }))}
                        />
                      </div>
                      <div style={chatStyles.profileField}>
                        <span style={chatStyles.profileLabel}>Семейный статус:</span>
                        <input
                          style={chatStyles.profileInput}
                          value={editData.status}
                          onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                        />
                      </div>
                      {/* Кнопки теперь внутри скроллируемой области, сразу после полей */}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          style={chatStyles.profileEditBtn}
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
                            fontSize: 15,
                            marginLeft: 0,
                            marginTop: 0,
                            marginBottom: 0,
                            background: "#35363a",
                            color: "#b2bec3",
                            boxShadow: "0 2px 8px #0002",
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
        </div>
      </div>
      <div style={chatStyles.chatContainer}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginBottom: 10,
          minHeight: 32
        }}>
          <div style={chatStyles.chatTitle}>Чат</div>
        </div>
        <div
          className="chat-box"
          style={chatStyles.chatBox}
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
                      {msg.fileType.startsWith("image/") ? (
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
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={chatStyles.inputRow}>
          {/* Кнопка выбора файла */}
          <button
            style={{
              ...(attachBtnHover ? { ...chatStyles.attachBtn, ...chatStyles.attachBtnHover } : chatStyles.attachBtn),
            }}
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Прикрепить файл"
            tabIndex={-1}
            onMouseEnter={() => setAttachBtnHover(true)}
            onMouseLeave={() => setAttachBtnHover(false)}
          >
            <span style={{ color: "#222", fontSize: 22, display: "flex", alignItems: "center" }}>📎</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={e => {
              if (e.target.files?.[0]) setFileToSend(e.target.files[0]);
            }}
          />
          <input
            style={chatStyles.input}
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
          <button
            style={chatStyles.sendBtn}
            onClick={handleSend}
            disabled={!selectedChannel || (!input.trim() && !fileToSend)}
          >
            Отправить
          </button>
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
    </div>
  );
}

export default App;