'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

const STORAGE_KEY = 'lightblue_messages';
const SESSION_KEY = 'lightblue_session';
const PASSCODE_KEY = 'lightblue_passcode';
const TTL_MS = 24 * 60 * 60 * 1000;

// ── Crypto helpers ───────────────────────────────────────────────────────────

async function hashPasscode(raw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.expiry > Date.now()) return s;
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch { return null; }
}

function createSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + TTL_MS }));
}

function loadMessages() {
  try {
    const msgs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const cutoff = Date.now() - TTL_MS;
    return msgs.filter((m) => m.ts > cutoff);
  } catch { return []; }
}

function saveMessages(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess }) {
  const [mode, setMode] = useState(null); // 'create' | 'login' | 'expired'
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const hasPasscode = !!localStorage.getItem(PASSCODE_KEY);
    const expired = !getSession() && hasPasscode;
    setMode(hasPasscode ? (expired ? 'expired' : 'login') : 'create');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');

    try {
      if (mode === 'create') {
        if (value.length < 4) { setError('minimum 4 characters'); setLoading(false); return; }
        if (value !== confirm) { setError("passcodes don't match"); setLoading(false); return; }
        const hashed = await hashPasscode(value);
        localStorage.setItem(PASSCODE_KEY, hashed);
        createSession();
        onSuccess();
      } else {
        const hashed = await hashPasscode(value);
        const stored = localStorage.getItem(PASSCODE_KEY);
        if (hashed === stored) {
          createSession();
          onSuccess();
        } else {
          setError('wrong passcode');
        }
      }
    } catch { setError('something went wrong'); }
    setLoading(false);
  }, [value, confirm, mode, onSuccess]);

  if (!mode) return null;

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>lightblue</div>
        <p className={styles.loginSub}>
          {mode === 'create'
            ? 'create a passcode to start'
            : mode === 'expired'
            ? 'session expired. log back in.'
            : 'welcome back'}
        </p>

        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={styles.loginInput}
            type="password"
            placeholder={mode === 'create' ? 'create a passcode' : 'enter your passcode'}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            autoComplete="current-password"
          />
          {mode === 'create' && (
            <input
              className={styles.loginInput}
              type="password"
              placeholder="confirm passcode"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              autoComplete="new-password"
            />
          )}
          {error && <p className={styles.loginError}>{error}</p>}
          <button className={styles.loginBtn} type="submit" disabled={loading || !value.trim()}>
            {loading ? '···' : mode === 'create' ? 'create' : 'enter'}
          </button>
        </form>

        <p className={styles.loginNote}>sessions last 24 hours · no account · no data sent</p>
      </div>
    </div>
  );
}

// ── Message ───────────────────────────────────────────────────────────────────

function Message({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`${styles.messageRow} ${isUser ? styles.user : ''}`}>
      <div className={`${styles.msgAvatar} ${isUser ? styles.you : styles.vanilla}`}>
        {isUser ? 'Y' : 'V'}
      </div>
      <div className={styles.msgBody}>
        <div className={styles.msgMeta}>
          <span className={styles.msgLabel}>{isUser ? 'you' : 'vanilla'}</span>
          <span className={styles.msgTime}>{formatTime(message.ts)}</span>
        </div>
        <div className={`${styles.bubble} ${isUser ? styles.user : styles.vanilla}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function Chat({ onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [speaker, setSpeaker] = useState('user');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const msg = { role: speaker === 'vanilla' ? 'assistant' : 'user', content: text, ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    saveMessages(next);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, messages, speaker]);

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

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    onLogout();
  }, [onLogout]);

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>V</div>
          <span className={styles.onlineDot} />
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>Vanilla</span>
          <span className={styles.headerStatus}>Private · messages delete after 24h</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.clearBtn} onClick={clearAll} title="Clear messages">clear</button>
          <button className={styles.clearBtn} onClick={logout} title="Log out">logout</button>
        </div>
      </header>

      <main className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>no messages yet. say something.</div>
        )}
        {messages.map((msg, i) => <Message key={i} message={msg} />)}
        <div ref={bottomRef} />
      </main>

      <footer className={styles.inputArea}>
        <button
          className={`${styles.speakerToggle} ${speaker === 'vanilla' ? styles.speakerVanilla : styles.speakerYou}`}
          onClick={() => setSpeaker((s) => s === 'user' ? 'vanilla' : 'user')}
          title="Switch speaker"
        >
          {speaker === 'vanilla' ? 'V' : 'Y'}
        </button>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder={speaker === 'vanilla' ? 'typing as Vanilla…' : 'say something…'}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.sendBtn}
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
  const [authed, setAuthed] = useState(null); // null = checking

  useEffect(() => {
    setAuthed(!!getSession());
  }, []);

  if (authed === null) return null; // avoid flash

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return <Chat onLogout={() => setAuthed(false)} />;
}
