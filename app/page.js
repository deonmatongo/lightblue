'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

const STORAGE_KEY = 'lightblue_messages';
const SESSION_KEY = 'lightblue_session';
const TTL_MS = 24 * 60 * 60 * 1000;

// ── Session ───────────────────────────────────────────────────────────────────

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.expiry > Date.now()) return s;
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch { return null; }
}

function createSession(username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, expiry: Date.now() + TTL_MS }));
}

// ── Messages ──────────────────────────────────────────────────────────────────

function loadMessages() {
  try {
    const msgs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return msgs.filter((m) => m.ts > Date.now() - TTL_MS);
  } catch { return []; }
}

function saveMessages(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess, expired }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const userRef = useRef(null);

  useEffect(() => { userRef.current?.focus(); }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'login failed'); return; }
      createSession(data.username);
      onSuccess(data.username);
    } catch { setError('connection error'); }
    setLoading(false);
  }, [username, password, onSuccess]);

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>lightblue</div>
        <p className={styles.loginSub}>
          {expired ? 'session expired. log back in.' : 'private conversation'}
        </p>
        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <input
            ref={userRef}
            className={styles.loginInput}
            type="text"
            placeholder="username"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
          />
          <input
            className={styles.loginInput}
            type="password"
            placeholder="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
          />
          {error && <p className={styles.loginError}>{error}</p>}
          <button
            className={styles.loginBtn}
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
          >
            {loading ? '···' : 'enter'}
          </button>
        </form>
        <p className={styles.loginNote}>sessions last 24 hours · messages delete after 24h</p>
      </div>
    </div>
  );
}

// ── Message ───────────────────────────────────────────────────────────────────

function Message({ message, currentUser }) {
  const isMine = message.sender === currentUser;
  const isVanilla = message.sender === 'vanilla';

  return (
    <div className={`${styles.messageRow} ${isMine ? styles.mine : ''}`}>
      <div className={`${styles.msgAvatar} ${isVanilla ? styles.avatarVanilla : styles.avatarRed}`}>
        {message.sender === 'vanilla' ? 'V' : 'R'}
      </div>
      <div className={styles.msgBody}>
        <div className={styles.msgMeta}>
          <span className={`${styles.msgLabel} ${isVanilla ? styles.labelVanilla : styles.labelRed}`}>
            {message.sender}
          </span>
          <span className={styles.msgTime}>{formatTime(message.ts)}</span>
        </div>
        <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${isVanilla ? styles.bubbleVanilla : styles.bubbleRed}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function Chat({ currentUser, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setMessages(loadMessages());

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setMessages(loadMessages());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const msg = { sender: currentUser, content: text, ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    saveMessages(next);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, messages, currentUser]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handleInput = useCallback((e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  const clearAll = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isVanilla = currentUser === 'vanilla';

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <div className={styles.avatarWrap}>
          <div className={`${styles.avatar} ${isVanilla ? styles.avatarVanilla : styles.avatarRed}`}>
            {isVanilla ? 'V' : 'R'}
          </div>
          <span className={`${styles.onlineDot} ${isVanilla ? styles.dotVanilla : styles.dotRed}`} />
        </div>
        <div className={styles.headerInfo}>
          <span className={`${styles.headerName} ${isVanilla ? styles.nameVanilla : styles.nameRed}`}>
            {currentUser}
          </span>
          <span className={styles.headerStatus}>Private · messages delete after 24h</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={clearAll}>clear</button>
          <button className={styles.clearBtn} onClick={onLogout}>logout</button>
        </div>
      </header>

      <main className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>no messages yet. say something.</div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} message={msg} currentUser={currentUser} />
        ))}
        <div ref={bottomRef} />
      </main>

      <footer className={styles.inputArea}>
        <textarea
          ref={textareaRef}
          className={`${styles.textarea} ${isVanilla ? styles.textareaVanilla : styles.textareaRed}`}
          rows={1}
          placeholder={`say something, ${currentUser}…`}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          className={`${styles.sendBtn} ${isVanilla ? styles.sendVanilla : styles.sendRed}`}
          onClick={sendMessage}
          disabled={!input.trim()}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </footer>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Page() {
  const [session, setSession] = useState(null); // null = checking
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSession(s || false);
    setExpired(!s && !!localStorage.getItem(SESSION_KEY + '_was'));
  }, []);

  if (session === null) return null;

  if (!session) {
    return (
      <LoginScreen
        expired={expired}
        onSuccess={(username) => {
          localStorage.setItem(SESSION_KEY + '_was', '1');
          setSession({ username });
          setExpired(false);
        }}
      />
    );
  }

  return (
    <Chat
      key={session.username}
      currentUser={session.username}
      onLogout={() => {
        localStorage.removeItem(SESSION_KEY);
        setSession(false);
        setExpired(true);
      }}
    />
  );
}
