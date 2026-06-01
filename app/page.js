'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

const STORAGE_KEY = 'lightblue_messages';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - TTL_MS;
    return parsed.filter((m) => m.ts > cutoff);
  } catch {
    return [];
  }
}

function saveMessages(msgs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {}
}

function Message({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`${styles.messageRow} ${isUser ? styles.user : ''}`}>
      <div className={`${styles.msgAvatar} ${isUser ? styles.you : styles.ru}`}>
        {isUser ? 'Y' : 'R'}
      </div>
      <div className={styles.msgBody}>
        <div className={styles.msgMeta}>
          <span className={styles.msgLabel}>{isUser ? 'you' : 'ru'}</span>
          <span className={styles.msgTime}>{formatTime(message.ts)}</span>
        </div>
        <div className={`${styles.bubble} ${isUser ? styles.user : styles.ru}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [speaker, setSpeaker] = useState('user'); // 'user' | 'ru'
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = loadMessages();
    setMessages(saved);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const msg = { role: speaker === 'ru' ? 'assistant' : 'user', content: text, ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    saveMessages(next);
    setInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, messages, speaker]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

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

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>R</div>
          <span className={styles.onlineDot} />
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>Ru</span>
          <span className={styles.headerStatus}>Private · messages delete after 24h</span>
        </div>
        <button className={styles.clearBtn} onClick={clearAll} title="Clear all messages">
          clear
        </button>
      </header>

      <main className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>no messages yet. say something.</div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </main>

      <footer className={styles.inputArea}>
        <button
          className={`${styles.speakerToggle} ${speaker === 'ru' ? styles.speakerRu : styles.speakerYou}`}
          onClick={() => setSpeaker((s) => (s === 'user' ? 'ru' : 'user'))}
          title="Switch speaker"
        >
          {speaker === 'ru' ? 'R' : 'Y'}
        </button>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          placeholder={speaker === 'ru' ? 'typing as Ru…' : 'say something…'}
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
