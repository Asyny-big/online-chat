// КРИТИЧЕСКИЕ ИЗМЕНЕНИЯ В App.jsx:
// 1. Заменить все channels → chats
// 2. Заменить все selectedChannel → selectedChat  
// 3. Добавить поиск пользователей

// В секции состояний (строка ~32):
const [chats, setChats] = useState([]);
const [selectedChat, setSelectedChat] = useState(null);
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState([]);
const [searchLoading, setSearchLoading] = useState(false);

// Добавить useEffect для поиска (строка ~200, после других useEffect):
useEffect(() => {
  if (!token || !searchQuery.trim()) {
    setSearchResults([]);
    return;
  }

  const timer = setTimeout(async () => {
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_URL}/users/search?phone=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [searchQuery, token]);

// Функция создания чата (строка ~250):
const createChatWithUser = async (userId) => {
  try {
    const res = await axios.post(`${API_URL}/chats/private`, 
      { userId }, 
      { headers: { Authorization: `Bearer ${token}` }}
    );
    const newChat = res.data;
    
    setChats(prev => {
      const exists = prev.find(c => c._id === newChat._id);
      if (exists) return prev;
      return [newChat, ...prev];
    });
    
    setSelectedChat(newChat._id);
    setSearchQuery("");
    setSearchResults([]);
  } catch (error) {
    console.error('Create chat error:', error);
    alert('Ошибка создания чата');
  }
};

// В компоненте desktopMenu (строка ~600):
const desktopMenu = (
  <div style={{ width: 320, borderRight: "1px solid #1f2937", padding: 12, background: "#0b1220", minHeight: "100vh" }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button style={chatStyles.profileEditBtn} onClick={() => setShowProfile(true)}>Профиль</button>
      <button style={chatStyles.profileEditBtn} onClick={() => setShowCustomizer(true)}>Тема</button>
      <button style={chatStyles.profileLogoutBtn} onClick={handleLogout}>Выйти</button>
    </div>
    
    {/* ПОИСК */}
    <div style={{ marginBottom: 12 }}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Введите номер телефона"
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #1f2937",
          background: "#0b1220",
          color: "#fff",
          fontSize: 14
        }}
      />
    </div>

    {/* РЕЗУЛЬТАТЫ ПОИСКА */}
    {searchQuery && (
      <div style={{ marginBottom: 12 }}>
        {searchLoading && <div style={{ color: "#b2bec3", fontSize: 13, padding: "10px 0" }}>Поиск...</div>}
        {!searchLoading && searchResults.length === 0 && <div style={{ color: "#b2bec3", fontSize: 13, padding: "10px 0" }}>Пользователь не найден</div>}
        {!searchLoading && searchResults.map((user) => (
          <button
            key={user._id}
            onClick={() => createChatWithUser(user._id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #00c3ff",
              background: "#0b1220",
              color: "#fff",
              cursor: "pointer",
              marginBottom: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2
            }}
          >
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#b2bec3" }}>{user.phone}</div>
          </button>
        ))}
      </div>
    )}

    {/* СПИСОК ЧАТОВ */}
    {!searchQuery && (
      <>
        <div style={{ color: "#b2bec3", fontSize: 12, marginBottom: 8 }}>Чаты</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {chats.map((c) => (
            <button
              key={c._id}
              onClick={() => setSelectedChat(c._id)}
              style={{
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #233",
                background: selectedChat === c._id ? "#1f2937" : "#0b1220",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              {c.displayName || c.name || "Чат"}
            </button>
          ))}
        </div>
      </>
    )}
  </div>
);

// ВАЖНО: Заменить все упоминания:
// - channels → chats
// - setChannels → setChats  
// - selectedChannel → selectedChat
// - setSelectedChannel → setSelectedChat

// В useEffect для загрузки чатов (строка ~400):
axios.get(`${API_URL}/chats`, { headers: { Authorization: `Bearer ${token}` }})
  .then(res => setChats(res.data || []))
  .catch(() => setChats([]));

// В useEffect для сообщений (строка ~500):
useEffect(() => {
  if (!token || !selectedChat) return;
  axios.get(`${API_URL}/messages/${selectedChat}`, { headers: { Authorization: `Bearer ${token}` }})
    .then(res => setMessages(res.data || []))
    .catch(() => setMessages([]));
}, [token, selectedChat]);

// В Socket.IO обработчиках (строка ~450):
s.on("message:new", (payload) => {
  const chatId = payload?.chatId;
  const message = payload?.message ?? payload;
  if (!chatId || !message) return;

  setChats(prev => {
    const idx = prev.findIndex(c => c._id === chatId);
    if (idx === -1) return prev;
    const updated = [...prev];
    updated[idx] = { ...updated[idx], lastMessage: message };
    updated.splice(idx, 1);
    updated.unshift(updated[idx]);
    return updated;
  });

  if (selectedChat === chatId) {
    setMessages(prev => [...prev, message]);
  }
});

// В handleSend (строка ~350):
socketRef.current.emit("message:send", {
  chatId: selectedChat,
  text: input.trim(),
  ...filePayload
});
