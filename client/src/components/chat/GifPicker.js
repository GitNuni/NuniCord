import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const TENOR_KEY = process.env.REACT_APP_TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPzpgtfajLYNLzk4';
const TENOR_URL = 'https://tenor.googleapis.com/v2';

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchTrending();
  }, []);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res = await fetch(
        `${TENOR_URL}/featured?key=${TENOR_KEY}&limit=30&media_filter=gif`
      );
      const data = await res.json();
      setTrending(data.results || []);
    } catch { /* offline / no key */ }
    setLoading(false);
  }

  async function searchGifs(q) {
    if (!q.trim()) { setGifs([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${TENOR_URL}/search?key=${TENOR_KEY}&q=${encodeURIComponent(q)}&limit=30&media_filter=gif`
      );
      const data = await res.json();
      setGifs(data.results || []);
    } catch { /* offline */ }
    setLoading(false);
  }

  function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(val), 400);
  }

  function handleSelect(gif) {
    const url = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url;
    if (url) onSelect(url);
  }

  const displayed = query ? gifs : trending;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        width: 360,
        maxHeight: 380,
        background: '#040a0f',
        border: '1px solid rgba(0,212,255,0.25)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(0,212,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        marginBottom: 4,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 10px',
          borderBottom: '1px solid rgba(0,212,255,0.15)',
          background: '#030810',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#00d4ff',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}
        >
          GIF
        </span>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={12}
            style={{
              position: 'absolute', left: 8, top: '50%',
              transform: 'translateY(-50%)', color: '#2a5870',
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={handleSearch}
            placeholder="Search GIFs..."
            style={{
              width: '100%',
              background: '#0b1820',
              border: '1px solid rgba(0,212,255,0.15)',
              color: '#9ecfdf',
              fontSize: 12,
              padding: '4px 8px 4px 26px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(0,212,255,0.15)'}
          />
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: '#2a5870', cursor: 'pointer', padding: 2,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ff3c00'}
          onMouseLeave={e => e.currentTarget.style.color = '#2a5870'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Category label */}
      {!query && (
        <div style={{ padding: '6px 10px 2px', fontSize: 9, color: '#2a5870', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          TRENDING
        </div>
      )}

      {/* Grid */}
      <div
        className="ctos-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: 6 }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div className="ctos-spinner" />
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#2e5568', fontSize: 12 }}>
            {query ? 'NO RESULTS FOUND' : 'CONNECT TO LOAD GIFS'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
            }}
          >
            {displayed.map((gif) => {
              const thumb = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url;
              return (
                <button
                  key={gif.id}
                  onClick={() => handleSelect(gif)}
                  style={{
                    background: '#0b1820',
                    border: '1px solid rgba(0,212,255,0.08)',
                    padding: 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    aspectRatio: '1',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)';
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(0,212,255,0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <img
                    src={thumb}
                    alt={gif.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(0,212,255,0.1)',
          padding: '4px 10px',
          fontSize: 9,
          color: '#1e3d50',
          letterSpacing: '0.1em',
          textAlign: 'right',
        }}
      >
        POWERED BY TENOR
      </div>
    </div>
  );
}
