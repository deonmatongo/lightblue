'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import styles from './page.module.css';

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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Fetch all current messages ────────────────────────────────────────────────

async function fetchMessages() {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess, expired }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    setTimeout(() => userRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'wrong username or password'); setLoading(false); return; }
      createSession(data.username);
      onSuccess(data.username);
    } catch { setError('connection error — check your internet'); }
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
            autoCorrect="off"
            spellCheck="false"
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

// ── Image viewer overlay ──────────────────────────────────────────────────────

function ImageViewer({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.viewerOverlay} onClick={onClose}>
      <img
        className={styles.viewerImg}
        src={url}
        alt="shared image"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      />
      <button className={styles.viewerClose} onClick={onClose} aria-label="Close">×</button>
      <p className={styles.viewerHint}>tap anywhere to close</p>
    </div>
  );
}

// ── Message ───────────────────────────────────────────────────────────────────

function Message({ message, currentUser, onViewImage }) {
  const isMine = message.sender === currentUser;
  const isVanilla = message.sender === 'vanilla';
  const isImage = message.type === 'image';
  const isExpired = isImage && (!message.media_url || message.views_remaining === 0);

  return (
    <div className={`${styles.messageRow} ${isMine ? styles.mine : ''}`}>
      <div className={`${styles.msgAvatar} ${isVanilla ? styles.avatarVanilla : styles.avatarRed}`}>
        {isVanilla ? 'V' : 'R'}
      </div>
      <div className={styles.msgBody}>
        <div className={styles.msgMeta}>
          <span className={`${styles.msgLabel} ${isVanilla ? styles.labelVanilla : styles.labelRed}`}>
            {message.sender}
          </span>
          <span className={styles.msgTime}>{formatTime(message.created_at)}</span>
        </div>

        {isImage ? (
          isExpired ? (
            <div className={`${styles.imgBubble} ${styles.imgExpired}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              image expired
            </div>
          ) : (
            <button
              className={`${styles.imgBubble} ${styles.imgTap} ${isMine ? styles.imgTapMine : styles.imgTapOther}`}
              onClick={() => onViewImage(message)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className={styles.imgTapLabel}>tap to view</span>
              <span className={styles.imgTapCount}>
                {message.views_remaining} {message.views_remaining === 1 ? 'view' : 'views'} left
              </span>
            </button>
          )
        ) : (
          <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${isVanilla ? styles.bubbleVanilla : styles.bubbleRed}`}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function Chat({ currentUser, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const latestCreatedAt = useRef(null);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // ── Load + real-time + polling fallback ──

  useEffect(() => {
    // Purge expired messages then load
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    supabase.from('messages').delete().lt('created_at', cutoff).then(() => {
      fetchMessages().then((data) => {
        setMessages(data);
        if (data.length) latestCreatedAt.current = data[data.length - 1].created_at;
        scrollToBottom('instant');
      });
    });

    // Real-time subscription
    const channel = supabase
      .channel(`chat-${currentUser}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            latestCreatedAt.current = payload.new.created_at;
            return [...prev, payload.new];
          });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => setMessages((prev) =>
          prev.map((m) => m.id === payload.new.id ? payload.new : m)
        )
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
      )
      .subscribe();

    // Polling fallback every 4s — catches any messages missed by real-time
    const poll = setInterval(async () => {
      try {
        const data = await fetchMessages();
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const newMsgs = data.filter((m) => !prevIds.has(m.id));
          if (!newMsgs.length) return prev;
          // Also update any changed messages (view counts etc)
          const merged = prev.map((m) => data.find((d) => d.id === m.id) || m);
          return [...merged, ...newMsgs].sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
          );
        });
      } catch { /* silent */ }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [currentUser, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Scroll to bottom when keyboard opens on mobile
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onFocus = () => setTimeout(() => scrollToBottom('instant'), 300);
    ta.addEventListener('focus', onFocus);
    return () => ta.removeEventListener('focus', onFocus);
  }, [scrollToBottom]);

  // ── Text send ──

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(false);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const { error } = await supabase
      .from('messages')
      .insert({ sender: currentUser, content: text, type: 'text' });

    if (error) {
      setSendError(true);
      setInput(text); // restore so user can retry
      setTimeout(() => setSendError(false), 3000);
    }
    setSending(false);
  }, [input, sending, currentUser]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handleInput = useCallback((e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  // ── Image pick & send ──

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) { alert('Image must be under 4 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview({ file, dataUrl: ev.target.result });
    reader.readAsDataURL(file);
    fileInputRef.current.value = '';
  }, []);

  const sendImage = useCallback(async () => {
    if (!imagePreview || uploading) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', imagePreview.file);
    fd.append('sender', currentUser);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      setImagePreview(null);
    } catch { alert('Failed to send image. Please try again.'); }
    setUploading(false);
  }, [imagePreview, uploading, currentUser]);

  // ── Image view ──

  const handleViewImage = useCallback(async (message) => {
    const res = await fetch(`/api/view/${message.id}`, { method: 'POST' });
    const data = await res.json();
    if (data.expired || !data.url) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, views_remaining: data.viewsLeft, media_url: data.viewsLeft === 0 ? null : m.media_url }
          : m
      )
    );
    setViewingImage({ url: data.url });
  }, []);

  // ── Clear / logout ──

  const clearAll = useCallback(async () => {
    await supabase.from('messages').delete().gt('created_at', '2000-01-01T00:00:00Z');
    setMessages([]);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    onLogout();
  }, [onLogout]);

  const isVanilla = currentUser === 'vanilla';
  // Header shows WHO you're talking TO, not who you are
  const otherUser = isVanilla ? 'red' : 'vanilla';
  const otherIsVanilla = otherUser === 'vanilla';

  return (
    <>
      {viewingImage && (
        <ImageViewer url={viewingImage.url} onClose={() => setViewingImage(null)} />
      )}

      <div className={styles.chat}>
        <header className={styles.header}>
          <div className={styles.avatarWrap}>
            <div className={`${styles.avatar} ${otherIsVanilla ? styles.avatarVanilla : styles.avatarRed}`}>
              {otherIsVanilla ? 'V' : 'R'}
            </div>
            <span className={`${styles.onlineDot} ${otherIsVanilla ? styles.dotVanilla : styles.dotRed}`} />
          </div>
          <div className={styles.headerInfo}>
            <span className={`${styles.headerName} ${otherIsVanilla ? styles.nameVanilla : styles.nameRed}`}>
              {otherUser}
            </span>
            <span className={styles.headerStatus}>you are {currentUser} · private</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.clearBtn} onClick={clearAll}>clear</button>
            <button className={styles.clearBtn} onClick={logout}>logout</button>
          </div>
        </header>

        <main className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>no messages yet.</div>
          )}
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} currentUser={currentUser} onViewImage={handleViewImage} />
          ))}
          <div ref={bottomRef} style={{ height: 1 }} />
        </main>

        {sendError && (
          <div className={styles.sendErrBanner}>failed to send — tap to retry</div>
        )}

        <footer className={styles.inputArea}>
          {imagePreview ? (
            <div className={styles.previewBar}>
              <img src={imagePreview.dataUrl} className={styles.previewThumb} alt="preview" />
              <div className={styles.previewActions}>
                <button className={styles.clearBtn} onClick={() => setImagePreview(null)} disabled={uploading}>
                  cancel
                </button>
                <button
                  className={`${styles.sendBtn} ${isVanilla ? styles.sendVanilla : styles.sendRed}`}
                  onClick={sendImage}
                  disabled={uploading}
                  style={{ width: 'auto', padding: '0 18px', fontSize: '12px', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em' }}
                >
                  {uploading ? '···' : 'send'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
              <button
                className={`${styles.iconBtn} ${isVanilla ? styles.iconBtnVanilla : styles.iconBtnRed}`}
                onClick={() => fileInputRef.current.click()}
                aria-label="Send image"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                className={`${styles.textarea} ${isVanilla ? styles.textareaVanilla : styles.textareaRed}`}
                rows={1}
                placeholder={`message as ${currentUser}…`}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />
              <button
                className={`${styles.sendBtn} ${isVanilla ? styles.sendVanilla : styles.sendRed}`}
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </>
          )}
        </footer>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Page() {
  const [session, setSession] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSession(s || false);
    if (!s) setExpired(!!localStorage.getItem('lightblue_had_session'));
  }, []);

  if (session === null) return null;

  if (!session) {
    return (
      <LoginScreen
        expired={expired}
        onSuccess={(username) => {
          localStorage.setItem('lightblue_had_session', '1');
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
      onLogout={() => { setSession(false); setExpired(true); }}
    />
  );
}
