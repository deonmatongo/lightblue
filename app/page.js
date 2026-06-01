'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import styles from './page.module.css';

const SESSION_KEY = 'lightblue_session';
const TTL_MS = 24 * 60 * 60 * 1000;

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

function formatDate(ts) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

async function fetchMessages() {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .gt('created_at', new Date(Date.now() - TTL_MS).toISOString())
    .order('created_at', { ascending: true });
  return data || [];
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess, expired }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const userRef = useRef(null);

  useEffect(() => { setTimeout(() => userRef.current?.focus(), 80); }, []);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'wrong credentials'); setLoading(false); return; }
      createSession(data.username);
      onSuccess(data.username);
    } catch { setError('connection error'); }
    setLoading(false);
  }, [username, password, onSuccess]);

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>lightblue</div>
        {expired && <p className={styles.loginSub}>session expired — sign back in</p>}
        <form className={styles.loginForm} onSubmit={submit}>
          <input ref={userRef} className={styles.loginInput} type="text"
            placeholder="username" value={username} autoCapitalize="none"
            autoCorrect="off" spellCheck="false" autoComplete="username"
            onChange={(e) => { setUsername(e.target.value); setError(''); }} />
          <input className={styles.loginInput} type="password"
            placeholder="password" value={password} autoComplete="current-password"
            onChange={(e) => { setPassword(e.target.value); setError(''); }} />
          {error && <p className={styles.loginError}>{error}</p>}
          <button className={styles.loginBtn} type="submit"
            disabled={loading || !username.trim() || !password.trim()}>
            {loading ? '···' : 'sign in'}
          </button>
        </form>
        <p className={styles.loginNote}>sessions last 24 hours</p>
      </div>
    </div>
  );
}

// ── Image viewer ──────────────────────────────────────────────────────────────

function ImageViewer({ url, onClose }) {
  const [err, setErr] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className={styles.viewerOverlay} onClick={onClose}>
      {err ? (
        <div className={styles.viewerErr}>
          <p>Could not load image</p>
          <p style={{ fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>It may have already expired</p>
        </div>
      ) : (
        <img className={styles.viewerImg} src={url} alt="shared"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setErr(true)}
        />
      )}
      <button className={styles.viewerClose} onClick={onClose}>×</button>
      <p className={styles.viewerHint}>tap to close</p>
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSep({ ts }) {
  return <div className={styles.dateSep}><span>{formatDate(ts)}</span></div>;
}

// ── Single message ────────────────────────────────────────────────────────────

function Message({ message, currentUser, onViewImage, isFirst }) {
  const isMine = message.sender === currentUser;
  const isVanilla = message.sender === 'vanilla';
  const isImage = message.type === 'image';
  const isExpired = isImage && (!message.media_url || message.views_remaining === 0);

  return (
    <div className={`${styles.msgRow} ${isMine ? styles.msgMine : styles.msgTheirs}`}>
      {!isMine && (
        <div className={`${styles.msgAvatar} ${isVanilla ? styles.avVanilla : styles.avRed}`}>
          {isVanilla ? 'V' : 'R'}
        </div>
      )}

      <div className={`${styles.msgWrap} ${isMine ? styles.msgWrapMine : styles.msgWrapTheirs}`}>
        {isImage ? (
          isExpired ? (
            <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${styles.imgExpiredBubble}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>image expired</span>
              <span className={styles.bubbleTime}>{formatTime(message.created_at)}</span>
            </div>
          ) : (
            <button
              className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${styles.imgTapBubble}`}
              onClick={() => onViewImage(message)}
            >
              <div className={styles.imgTapInner}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <div>
                  <p className={styles.imgTapLabel}>Tap to view</p>
                  <p className={styles.imgTapCount}>{message.views_remaining} {message.views_remaining === 1 ? 'view' : 'views'} remaining</p>
                </div>
              </div>
              <span className={styles.bubbleTime}>{formatTime(message.created_at)}</span>
            </button>
          )
        ) : (
          <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${isFirst ? (isMine ? styles.firstMine : styles.firstTheirs) : ''}`}>
            <span className={styles.bubbleText}>{message.content}</span>
            <span className={styles.bubbleTime}>{formatTime(message.created_at)}</span>
          </div>
        )}
      </div>

      {isMine && <div className={styles.msgSpacer} />}
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

  const scrollToBottom = useCallback((b = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior: b });
  }, []);

  useEffect(() => {
    supabase.from('messages').delete().lt('created_at', new Date(Date.now() - TTL_MS).toISOString())
      .then(() => fetchMessages().then((d) => { setMessages(d); scrollToBottom('instant'); }));

    const ch = supabase.channel(`chat-${currentUser}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        setMessages((prev) => prev.find((m) => m.id === p.new.id) ? prev : [...prev, p.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        setMessages((prev) => prev.map((m) => m.id === p.new.id ? p.new : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        setMessages((prev) => prev.filter((m) => m.id !== p.old.id));
      })
      .subscribe();

    const poll = setInterval(() => {
      fetchMessages().then((data) => {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = data.filter((m) => !ids.has(m.id));
          if (!fresh.length) return prev.map((m) => data.find((d) => d.id === m.id) || m);
          return [...prev.map((m) => data.find((d) => d.id === m.id) || m), ...fresh]
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      }).catch(() => {});
    }, 4000);

    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [currentUser, scrollToBottom]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const h = () => setTimeout(() => scrollToBottom('instant'), 350);
    ta.addEventListener('focus', h);
    return () => ta.removeEventListener('focus', h);
  }, [scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setSendError(false);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const { error } = await supabase.from('messages').insert({ sender: currentUser, content: text, type: 'text' });
    if (error) { setSendError(true); setInput(text); setTimeout(() => setSendError(false), 3000); }
    setSending(false);
  }, [input, sending, currentUser]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const handleInput = useCallback((e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px';
  }, []);

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) { alert('Max 4 MB'); return; }
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
      if (!res.ok) throw new Error();
      setImagePreview(null);
    } catch { alert('Upload failed. Try again.'); }
    setUploading(false);
  }, [imagePreview, uploading, currentUser]);

  const handleViewImage = useCallback(async (msg) => {
    const res = await fetch(`/api/view/${msg.id}`, { method: 'POST' });
    const data = await res.json();
    if (data.expired || !data.url) return;
    setMessages((prev) => prev.map((m) => m.id === msg.id
      ? { ...m, views_remaining: data.viewsLeft, media_url: data.viewsLeft === 0 ? null : m.media_url }
      : m));
    setViewingImage({ url: data.url });
  }, []);

  const clearAll = useCallback(async () => {
    await supabase.from('messages').delete().gt('created_at', '2000-01-01T00:00:00Z');
    setMessages([]);
  }, []);

  const otherUser = currentUser === 'vanilla' ? 'red' : 'vanilla';
  const otherIsVanilla = otherUser === 'vanilla';
  const hasText = input.trim().length > 0;

  // Build message list with date separators
  const rows = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    if (!prev || !sameDay(prev.created_at, msg.created_at)) {
      rows.push({ type: 'date', ts: msg.created_at, id: `date-${msg.created_at}` });
    }
    const isFirst = !prev || prev.sender !== msg.sender || !sameDay(prev.created_at, msg.created_at);
    rows.push({ type: 'msg', msg, isFirst });
  });

  return (
    <>
      {viewingImage && <ImageViewer url={viewingImage.url} onClose={() => setViewingImage(null)} />}

      <div className={styles.chat}>

        {/* ── WhatsApp-style header ── */}
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={onLogout} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className={styles.avatarWrap}>
            <div className={`${styles.headerAvatar} ${otherIsVanilla ? styles.avVanilla : styles.avRed}`}>
              {otherIsVanilla ? 'V' : 'R'}
            </div>
            <span className={`${styles.onlineDot} ${otherIsVanilla ? styles.dotVanilla : styles.dotRed}`} />
          </div>

          <div className={styles.headerInfo}>
            <span className={`${styles.headerName} ${otherIsVanilla ? styles.nameVanilla : styles.nameRed}`}>
              {otherUser}
            </span>
            <span className={styles.headerOnline}>Online</span>
          </div>

          <div className={styles.headerIcons}>
            <button className={styles.hdrIconBtn} aria-label="Video call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </button>
            <button className={styles.hdrIconBtn} onClick={clearAll} aria-label="Clear chat">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </header>

        {/* ── Messages ── */}
        <main className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p>No messages yet</p>
              <p className={styles.emptyHint}>Say something to {otherUser} 👋</p>
            </div>
          )}

          {rows.map((row) =>
            row.type === 'date'
              ? <DateSep key={row.id} ts={row.ts} />
              : <Message key={row.msg.id} message={row.msg} currentUser={currentUser} onViewImage={handleViewImage} isFirst={row.isFirst} />
          )}
          <div ref={bottomRef} style={{ height: 8 }} />
        </main>

        {sendError && (
          <div className={styles.errBanner}>⚠ Failed to send — check your connection</div>
        )}

        {/* ── Input bar ── */}
        <footer className={styles.inputArea}>
          {imagePreview ? (
            <div className={styles.previewBar}>
              <img src={imagePreview.dataUrl} className={styles.previewThumb} alt="preview" />
              <span className={styles.previewName}>{imagePreview.file.name}</span>
              <button className={styles.previewCancel} onClick={() => setImagePreview(null)} disabled={uploading}>✕</button>
              <button className={`${styles.sendCircle} ${otherIsVanilla ? styles.sendCircleVanilla : styles.sendCircleRed}`}
                onClick={sendImage} disabled={uploading}>
                {uploading
                  ? <span className={styles.sendDots}>···</span>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                }
              </button>
            </div>
          ) : (
            <div className={styles.inputRow}>
              <div className={styles.inputPill}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                <button className={styles.attachBtn} onClick={() => fileInputRef.current.click()} aria-label="Attach image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  rows={1}
                  placeholder="Message…"
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
              </div>
              <button
                className={`${styles.sendCircle} ${otherIsVanilla ? styles.sendCircleVanilla : styles.sendCircleRed}`}
                onClick={sendMessage}
                disabled={!hasText || sending}
                aria-label="Send"
              >
                {hasText
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                }
              </button>
            </div>
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
        onSuccess={(u) => { localStorage.setItem('lightblue_had_session', '1'); setSession({ username: u }); setExpired(false); }}
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
