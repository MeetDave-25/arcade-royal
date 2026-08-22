import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { motion, useScroll, useTransform } from 'framer-motion';
import PokemonReveal from './PokemonReveal';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

// ── Timer Arc Component ─────────────────────────────────────────────────────
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function TimerArc({ timeLeft, maxTime = 15 }) {
  const progress = Math.max(0, timeLeft / maxTime);
  const offset = CIRCUMFERENCE * (1 - progress);
  const hue = Math.round(progress * 120); // green→yellow→red
  const color = `hsl(${hue}, 100%, 55%)`;

  return (
    <div className="timer-arc-wrapper">
      <svg className="timer-arc-svg" width="90" height="90" viewBox="0 0 90 90">
        <circle className="timer-arc-track" cx="45" cy="45" r={RADIUS} />
        <circle
          className="timer-arc-fill"
          cx="45" cy="45" r={RADIUS}
          stroke={color}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="timer-arc-number" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [isRevealed, setIsRevealed] = useState(false);
  const [gameState, setGameState] = useState({ phase: 'LOBBY', players: {}, leaderboard: [], currentQuestionIndex: 0, totalQuestions: 0 });
  const [liveAnalytics, setLiveAnalytics] = useState({ totalAnswers: 0, optionCounts: [0, 0, 0, 0], fastestFingers: [], correctOption: null });
  
  // UI States
  const [uiView, setUiView] = useState('LANDING'); // LANDING, ENTER_GAME, ADMIN_LOGIN, JOINED
  const [nickname, setNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  
  // Game States
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime] = useState(15);
  const [answerResult, setAnswerResult] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [prevScore, setPrevScore] = useState(0);
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  
  // OTP Verification States
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Question Management States
  const [showQuestionManager, setShowQuestionManager] = useState(false);
  const [managedQuestions, setManagedQuestions] = useState({ questionsG1: [], questionsG2: [] });
  const [qmActiveTab, setQmActiveTab] = useState('GAME1');
  const [editingQ, setEditingQ] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [qmNotification, setQmNotification] = useState('');
  
  // Music State
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);

  // Safe accessors
  const safePlayers = gameState?.players || {};
  const safePlayerList = Object.values(safePlayers);
  const safePlayerCount = safePlayerList.length;
  const safeMyPlayer = (socket?.id && safePlayers[socket.id]) ? safePlayers[socket.id] : null;
  const safeCurrentQuestion = gameState?.currentQuestion;
  const safeAnalytics = liveAnalytics || { totalAnswers: 0, optionCounts: [0, 0, 0, 0], fastestFingers: [], correctOption: null };

  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -200]);

  const fetchManagedQuestions = useCallback(() => {
    socket.emit('adminGetQuestions', (res) => {
      if (res && res.success) {
        setManagedQuestions({ questionsG1: res.questionsG1 || [], questionsG2: res.questionsG2 || [] });
      }
    });
  }, []);

  // Music toggle — uses Web Audio API beep fallback if mp3 not found
  const toggleMusic = () => {
    if (audioRef.current && audioRef.current.src && !audioRef.current.error) {
      if (isMusicPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => playBeepFallback());
      }
    } else {
      playBeepFallback();
    }
    setIsMusicPlaying(prev => !prev);
  };

  const playBeepFallback = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Silent catch
    }
  };

  useEffect(() => {
    socket.on('gameStateUpdate', (state) => {
      setGameState(state);
    });

    socket.on('liveAnalytics', (analytics) => {
      setLiveAnalytics(analytics);
    });

    socket.on('questionsUpdated', (data) => {
      setManagedQuestions(data);
    });

    socket.on('question', (q) => {
      setSelectedOption(null);
      setAnswerResult(null);
    });

    socket.on('timer', (t) => {
      setTimeLeft(t);
    });

    socket.on('answerResult', (result) => {
      setAnswerResult(result);
    });

    socket.on('otpResult', (res) => {
      if (res.success) {
        setOtpError('');
      } else {
        setOtpError(res.error || 'Invalid OTP');
      }
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('liveAnalytics');
      socket.off('questionsUpdated');
      socket.off('question');
      socket.off('timer');
      socket.off('answerResult');
      socket.off('otpResult');
    };
  }, []);

  // Animate score when it changes
  useEffect(() => {
    const myScore = safeMyPlayer?.score ?? 0;
    if (myScore !== prevScore && myScore > prevScore) {
      setPrevScore(myScore);
      setScoreAnimKey(k => k + 1);
    }
  }, [safeMyPlayer?.score]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (nickname.trim() === '') return;
    socket.emit('joinGame', nickname.trim());
    setUiView('JOINED');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setAdminLoginError('');
    socket.emit('adminAuth', adminPassword, (res) => {
      if (res.success) {
        setIsAdmin(true);
        setUiView('JOINED');
        fetchManagedQuestions();
      } else {
        setAdminLoginError(res.error || 'Incorrect password!');
      }
    });
  };

  const submitAnswer = (optionIndex) => {
    if (selectedOption !== null || answerResult) return;
    setSelectedOption(optionIndex);
    socket.emit('submitAnswer', optionIndex);
  };

  const adminAction = (action, payload) => {
    socket.emit('adminAction', action, payload);
  };

  const submitOtp = (e) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    socket.emit('verifyOtp', otpInput.trim());
  };

  // ── Question Manager Modal Component ─────────────────────────────────────
  const renderQuestionManagerModal = () => {
    if (!showQuestionManager) return null;

    const currentList = qmActiveTab === 'GAME1' ? (managedQuestions.questionsG1 || []) : (managedQuestions.questionsG2 || []);

    const handleSaveQ = (e) => {
      e.preventDefault();
      if (!editingQ || !editingQ.text) return;
      socket.emit('adminSaveQuestion', { gameId: qmActiveTab, question: editingQ }, (res) => {
        if (res && res.success) {
          setManagedQuestions({ questionsG1: res.questionsG1, questionsG2: res.questionsG2 });
          setEditingQ(null);
          setQmNotification('✅ Question saved & published live!');
          setTimeout(() => setQmNotification(''), 3000);
        } else {
          setQmNotification('❌ Error: ' + (res?.error || 'Failed to save question'));
        }
      });
    };

    const handleDeleteQ = (id) => {
      if (!window.confirm('Are you sure you want to delete this question?')) return;
      socket.emit('adminDeleteQuestion', id, (res) => {
        if (res && res.success) {
          setManagedQuestions({ questionsG1: res.questionsG1, questionsG2: res.questionsG2 });
          setEditingQ(null);
          setQmNotification('🗑️ Question deleted!');
          setTimeout(() => setQmNotification(''), 3000);
        }
      });
    };

    const handleMediaUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingMedia(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target.result;
        try {
          const res = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: base64, fileName: file.name })
          });
          const data = await res.json();
          if (data.success) {
            setEditingQ(prev => ({ ...prev, image: data.url }));
          } else {
            setEditingQ(prev => ({ ...prev, image: base64 }));
          }
        } catch (err) {
          setEditingQ(prev => ({ ...prev, image: base64 }));
        } finally {
          setUploadingMedia(false);
        }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
          
          {/* Header */}
          <div style={{ padding: '20px 25px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)' }}>
            <div>
              <span className="glass-badge" style={{ color: 'var(--cyan)', fontSize: '0.65rem' }}>LIVE QUESTION ENGINE</span>
              <h2 style={{ color: '#fff', fontFamily: 'var(--display-font)', fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>✏️ QUESTION MANAGER</h2>
            </div>
            <button onClick={() => { setShowQuestionManager(false); setEditingQ(null); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
          </div>

          {qmNotification && (
            <div style={{ background: 'rgba(34, 211, 238, 0.15)', borderBottom: '1px solid var(--cyan)', color: '#fff', padding: '10px 20px', fontSize: '0.85rem', fontFamily: 'var(--modern-font)', textAlign: 'center', fontWeight: 600 }}>
              {qmNotification}
            </div>
          )}

          {/* Subheader Tabs */}
          <div style={{ display: 'flex', gap: '10px', padding: '15px 25px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => { setQmActiveTab('GAME1'); setEditingQ(null); }}
                style={{ padding: '8px 16px', borderRadius: '9999px', border: '1px solid', borderColor: qmActiveTab === 'GAME1' ? 'var(--hot-pink)' : 'rgba(255,255,255,0.1)', background: qmActiveTab === 'GAME1' ? 'rgba(255,0,255,0.2)' : 'transparent', color: qmActiveTab === 'GAME1' ? '#fff' : '#aaa', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                🧠 GAME 1: MEME WAR ({managedQuestions.questionsG1?.length || 0})
              </button>
              <button 
                onClick={() => { setQmActiveTab('GAME2'); setEditingQ(null); }}
                style={{ padding: '8px 16px', borderRadius: '9999px', border: '1px solid', borderColor: qmActiveTab === 'GAME2' ? 'var(--cyan)' : 'rgba(255,255,255,0.1)', background: qmActiveTab === 'GAME2' ? 'rgba(0,255,255,0.2)' : 'transparent', color: qmActiveTab === 'GAME2' ? '#fff' : '#aaa', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                🎵 GAME 2: MOVIE & SONG ({managedQuestions.questionsG2?.length || 0})
              </button>
            </div>

            {!editingQ && (
              <button 
                onClick={() => setEditingQ({ text: '', image: '', options: ['', '', '', ''], answer: 0 })}
                className="navbar-btn-primary"
                style={{ fontSize: '0.7rem', padding: '6px 14px' }}
              >
                ➕ ADD NEW QUESTION
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
            {editingQ ? (
              /* QUESTION FORM EDITOR */
              <form onSubmit={handleSaveQ} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: 'var(--cyan)', fontFamily: 'var(--modern-font)', fontSize: '1.1rem', fontWeight: 700 }}>
                    {editingQ.id ? `✏️ EDITING QUESTION #${editingQ.id}` : '➕ CREATE NEW QUESTION'}
                  </h3>
                  <button type="button" onClick={() => setEditingQ(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>QUESTION TEXT *</label>
                  <textarea 
                    value={editingQ.text} 
                    onChange={(e) => setEditingQ({ ...editingQ, text: e.target.value })} 
                    placeholder="e.g. 🐱 Q3. What is the cat doing?" 
                    required 
                    rows={2} 
                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', fontFamily: 'var(--body-font)', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>IMAGE / VIDEO MEDIA</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      onChange={handleMediaUpload} 
                      style={{ color: '#aaa', fontSize: '0.8rem' }}
                    />
                    {uploadingMedia && <span style={{ color: 'var(--cyan)', fontSize: '0.8rem' }}>Uploading media...</span>}
                  </div>

                  <input 
                    type="text" 
                    value={editingQ.image || ''} 
                    onChange={(e) => setEditingQ({ ...editingQ, image: e.target.value })} 
                    placeholder="Or paste media URL e.g. /meme/3.mp4 or https://..." 
                    style={{ width: '100%', padding: '10px', marginTop: '8px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />

                  {editingQ.image && (
                    <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                      <p style={{ color: '#888', fontSize: '0.7rem', marginBottom: '6px' }}>LIVE MEDIA PREVIEW:</p>
                      {editingQ.image.endsWith('.mp4') || editingQ.image.endsWith('.webm') ? (
                        <video src={editingQ.image} autoPlay loop muted playsInline style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '8px' }} />
                      ) : (
                        <img src={editingQ.image} alt="Preview" style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>ANSWER OPTIONS (SELECT CORRECT ONE WITH RADIO) *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[0, 1, 2, 3].map(optIdx => (
                      <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '10px', border: editingQ.answer === optIdx ? '1px solid var(--neon-green)' : '1px solid rgba(255,255,255,0.08)' }}>
                        <input 
                          type="radio" 
                          name="correctAnswer" 
                          checked={editingQ.answer === optIdx} 
                          onChange={() => setEditingQ({ ...editingQ, answer: optIdx })} 
                          style={{ accentColor: 'var(--neon-green)', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ color: editingQ.answer === optIdx ? 'var(--neon-green)' : '#aaa', fontWeight: 700, fontSize: '0.85rem', width: '25px' }}>
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <input 
                          type="text" 
                          value={editingQ.options?.[optIdx] || ''} 
                          onChange={(e) => {
                            const newOpts = [...(editingQ.options || ['', '', '', ''])];
                            newOpts[optIdx] = e.target.value;
                            setEditingQ({ ...editingQ, options: newOpts });
                          }} 
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`} 
                          required 
                          style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button type="submit" className="retro-btn" style={{ flex: 1, borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '14px', fontSize: '0.85rem' }}>
                    💾 SAVE & PUBLISH LIVE
                  </button>
                  {editingQ.id && (
                    <button type="button" onClick={() => handleDeleteQ(editingQ.id)} className="retro-btn" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '14px', fontSize: '0.85rem' }}>
                      🗑️ DELETE
                    </button>
                  )}
                </div>
              </form>
            ) : (
              /* QUESTION LIST VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {currentList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                    No questions created for this game yet. Click "➕ ADD NEW QUESTION" above!
                  </div>
                ) : (
                  currentList.map((q, idx) => (
                    <div key={q.id || idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      
                      {q.image && (
                        <div style={{ width: '70px', height: '55px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {q.image.endsWith('.mp4') || q.image.endsWith('.webm') ? (
                            <video src={q.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={q.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                          {idx + 1}. {q.text}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {q.options?.map((opt, oIdx) => (
                            <span key={oIdx} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: oIdx === q.answer ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255,255,255,0.05)', color: oIdx === q.answer ? 'var(--neon-green)' : '#9ca3af', border: oIdx === q.answer ? '1px solid var(--neon-green)' : '1px solid transparent', fontWeight: oIdx === q.answer ? 700 : 400 }}>
                              {oIdx === q.answer ? '✓ ' : ''}{String.fromCharCode(65 + oIdx)}: {opt}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingQ({ ...q })} className="navbar-btn-ghost" style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDeleteQ(q.id)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '9999px', padding: '6px 12px', fontSize: '0.7rem', cursor: 'pointer' }}>
                          🗑️
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </motion.div>
      </div>
    );
  };

  // ── Landing Page ─────────────────────────────────────────────────────────
  const renderLandingPage = () => (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Sticky Mobile-First App Header Navbar */}
      <header className="app-navbar">
        <div className="navbar-top-row">
          <a href="#" className="navbar-brand">
            <img src="/favicon.svg" alt="Arcade Royale Logo" className="navbar-logo" />
            <span className="navbar-title">ARCADE ROYALE</span>
          </a>
          <div className="navbar-actions">
            <button onClick={() => setUiView('ADMIN_LOGIN')} className="navbar-btn-ghost">
              HOST LOGIN
            </button>
            <button onClick={() => setUiView('ENTER_GAME')} className="navbar-btn-primary">
              JOIN NOW
            </button>
          </div>
        </div>

        <nav className="nav-center-links">
          <a href="#arena">ARENA</a>
          <a href="#modes">MODES</a>
          <a href="#poster">POSTER</a>
          <a href="#leaderboard">LEADERBOARD</a>
        </nav>
      </header>

      {/* Hero Section */}
      <header id="arena" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '140px 5% 60px 5%', position: 'relative', overflow: 'hidden' }}>
        <motion.div 
          style={{ y: yParallax, position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="glass-badge">✦ LEVEL 99 RETRO SHOWDOWN</div>

          <h1 className="hero-headline" style={{ marginTop: '25px', marginBottom: '20px' }}>
            THE ULTIMATE REAL-TIME <br/>
            <span className="italic-word">ARCADE</span> SHOWDOWN
          </h1>

          <p style={{ fontFamily: 'var(--body-font)', fontSize: '1.25rem', fontWeight: 300, color: '#9ca3af', lineHeight: 1.7, marginBottom: '45px', maxWidth: '650px' }}>
            A massive 100-player retro showdown. Test your reflexes, your meme knowledge, and your will to win in an immersive digital arena.
          </p>

          <div className="hero-cta-group">
            <button onClick={() => setUiView('ENTER_GAME')} className="magnetic-btn-primary">
              <div className="bg-hover" />
              <span>INSERT COIN</span>
            </button>
            
            <button onClick={() => setUiView('ADMIN_LOGIN')} className="glass-btn-secondary">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>HOST ARENA</span>
            </button>
          </div>
        </motion.div>

        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="scroll-indicator-line" />
        </div>
      </header>

      {/* Game Modes Cards */}
      <section id="modes" style={{ padding: '100px 5%', position: 'relative', zIndex: 10 }}>
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <div className="glass-badge" style={{ marginBottom: '15px' }}>GAME ARENA MODES</div>
          <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: '3rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
            CHOOSE YOUR <span style={{ color: 'var(--cyan)' }}>ARENA</span>
          </h2>
        </motion.div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', maxWidth: '1000px', margin: '0 auto' }}>
          {[
            { icon: '🧠', title: '1. Meme War (10 Qs)', desc: 'Test your knowledge of internet culture, viral reaction images, and legendary Bollywood memes. 10 rapid-fire questions.', color: 'var(--cyan)' },
            { icon: '🎵', title: '2. Guess Movie & Song (10 Qs)', desc: 'Identify iconic Bollywood songs and movies from emoji clues and hints. 10 high-stakes guessing questions.', color: 'var(--neon-green)' },
          ].map((mode, idx) => (
            <motion.div 
              key={idx}
              className="glass-card" 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              style={{ padding: '45px', borderTop: `2px solid ${mode.color}`, background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(16px)' }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>{mode.icon}</div>
              <h3 style={{ fontFamily: 'var(--display-font)', fontWeight: 700, color: '#fff', marginBottom: '12px', fontSize: '1.6rem' }}>{mode.title}</h3>
              <p style={{ fontFamily: 'var(--body-font)', lineHeight: '1.7', color: '#9ca3af', fontSize: '1rem', fontWeight: 300 }}>{mode.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Poster Section */}
      <section id="poster" style={{ padding: '100px 5%', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '60px', maxWidth: '1400px', margin: '0 auto' }}>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}
          >
            <motion.img 
              src="/poster.jpg" 
              alt="Arcade Royale Official Event Poster" 
              style={{ width: '100%', maxWidth: '480px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
              whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            style={{ flex: '1 1 500px', maxWidth: '650px' }}
          >
            <div className="glass-badge" style={{ marginBottom: '20px', color: 'var(--hot-pink)' }}>ARENA SHOWDOWN</div>
            <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: '3.5rem', color: '#ffffff', lineHeight: 1.1, marginBottom: '25px' }}>
              READY TO <br/>
              <span style={{ background: 'linear-gradient(135deg, var(--hot-pink), var(--cyan), var(--neon-green))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                DOMINATE?
              </span>
            </h2>
            <p style={{ fontFamily: 'var(--body-font)', fontSize: '1.2rem', fontWeight: 300, color: '#9ca3af', lineHeight: 1.8, marginBottom: '35px' }}>
              Gather your friends, enter the arena, and prove your worth on the global leaderboard. The arcade awaits your arrival.
            </p>
            <button onClick={() => setUiView('ENTER_GAME')} className="magnetic-btn-primary" style={{ width: '100%', padding: '20px' }}>
              <div className="bg-hover" />
              <span>JOIN THE ARENA NOW</span>
            </button>
          </motion.div>

        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-social-group">
          {['TWITTER', 'INSTAGRAM', 'DISCORD'].map((s, i) => (
            <a key={i} href="#" className="footer-social-pill">
              {s}
            </a>
          ))}
        </div>

        <div className="footer-author-badge">
          <span>BUILT BY</span>
          <span style={{ color: '#ffffff', fontWeight: 800 }}>MEET G. DAVE</span>
        </div>

        <div className="footer-copyright">
          ©2026 AiRA LAB. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );

  // ── Enter Game ─────────────────────────────────────────────────────────────
  const renderEnterGame = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="container"
      style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '60px 40px 45px 40px', position: 'relative', background: 'rgba(10,10,18,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.85)' }}>
        <button onClick={() => setUiView('LANDING')} className="nav-back-btn">
          ← BACK
        </button>

        <div style={{ textAlign: 'center', marginBottom: '35px', marginTop: '15px' }}>
          <div className="glass-badge" style={{ marginBottom: '16px', color: 'var(--cyan)' }}>✦ PLAYER PORTAL ✦</div>
          <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', color: '#fff', letterSpacing: '0.08em', lineHeight: 1.2 }}>ENTER THE ARENA</h2>
        </div>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--body-font)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase' }}>
              PLAYER NICKNAME
            </label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. CYBER_PUNK_99" 
              required
              className="portal-input"
            />
          </div>

          <button type="submit" className="auth-btn-primary">
            JOIN GAME
          </button>
        </form>
      </div>
    </motion.div>
  );

  // ── Admin Login ────────────────────────────────────────────────────────────
  const renderAdminLogin = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="container"
      style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '60px 40px 45px 40px', position: 'relative', background: 'rgba(10,10,18,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.85)' }}>
        <button onClick={() => setUiView('LANDING')} className="nav-back-btn">
          ← BACK
        </button>

        <div style={{ textAlign: 'center', marginBottom: '35px', marginTop: '15px' }}>
          <div className="glass-badge" style={{ marginBottom: '16px', color: 'var(--hot-pink)' }}>✦ ADMIN AUTHENTICATION ✦</div>
          <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', color: '#fff', letterSpacing: '0.08em', lineHeight: 1.2 }}>HOST ACCESS</h2>
        </div>

        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--body-font)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase' }}>
              HOST PASSWORD
            </label>
            <input 
              type="password" 
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter host password..." 
              required
              className="portal-input"
            />
          </div>

          {adminLoginError && (
            <p style={{ color: '#ef4444', fontFamily: 'var(--body-font)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
              {adminLoginError}
            </p>
          )}

          <button type="submit" className="auth-btn-primary">
            AUTHENTICATE HOST
          </button>
        </form>
      </div>
    </motion.div>
  );

  // ── Joined Lobby / Verification / Game ─────────────────────────────────────
  const renderJoinedLobby = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
    >
      <div className="glass-card" style={{ textAlign: 'center', padding: '50px', maxWidth: '600px', width: '100%' }}>
        <div className="glass-badge" style={{ marginBottom: '20px', color: 'var(--cyan)' }}>CONNECTED TO ARENA</div>
        
        {isAdmin ? (
          <div>
            <h2 style={{ fontFamily: 'var(--display-font)', color: '#fff', fontSize: '2rem', marginBottom: '15px' }}>HOST DASHBOARD</h2>
            <p style={{ color: '#9ca3af', fontFamily: 'var(--body-font)', marginBottom: '30px' }}>Players in lobby: <strong style={{ color: 'var(--neon-green)' }}>{safePlayerCount}</strong></p>
            
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => adminAction('START_VERIFICATION')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}>
                START PRESENCE CHECK ✋
              </button>
              <button onClick={() => { fetchManagedQuestions(); setShowQuestionManager(true); }} className="retro-btn" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)' }}>
                ✏️ EDIT & MANAGE QUESTIONS
              </button>
            </div>
          </div>
        ) : (
          <div>
            <motion.h2 animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', marginBottom: '20px', fontSize: '2rem' }}>
              WAITING FOR HOST...
            </motion.h2>
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '15px', padding: '30px', margin: '40px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '1.2rem', color: '#ccc', fontFamily: 'var(--modern-font)' }}>PLAYERS IN LOBBY</p>
              <p style={{ color: 'var(--cyan)', fontSize: '4rem', fontFamily: 'var(--retro-font)', marginTop: '20px' }}>{safePlayerCount}</p>
            </div>
            <p style={{ color: '#aaa', fontSize: '1.1rem', fontFamily: 'var(--modern-font)' }}>LOGGED IN AS:</p>
            <h3 style={{ color: 'var(--hot-pink)', marginTop: '10px', fontSize: '2rem', fontFamily: 'var(--retro-font)' }}>{nickname}</h3>
          </div>
        )}
      </div>
    </motion.div>
  );

  // ── Verification Page ─────────────────────────────────────────────────────
  const renderVerificationPage = () => {
    const verifiedCount = safePlayerList.filter(p => p && p.verified).length;
    const totalPlayers = safePlayerList.length;
    const myPlayer = safeMyPlayer;

    if (isAdmin) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px' }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '750px', padding: '50px', textAlign: 'center', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)' }}>
            <div className="glass-badge" style={{ marginBottom: '15px', color: 'var(--cyan)' }}>LIVE CHECK-IN SYSTEM</div>
            <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2.2rem', color: '#fff', marginBottom: '15px' }}>PRESENCE VERIFICATION</h1>
            
            {/* OTP Display */}
            <div style={{ background: 'rgba(34, 211, 238, 0.08)', border: '2px dashed var(--cyan)', borderRadius: '16px', padding: '20px', margin: '20px 0', textAlign: 'center' }}>
              <p style={{ color: '#aaa', fontFamily: 'var(--modern-font)', fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase' }}>✦ ROOM VERIFICATION OTP ✦</p>
              <div style={{ fontFamily: 'var(--retro-font)', fontSize: '4rem', color: 'var(--cyan)', letterSpacing: '12px', margin: '10px 0', textShadow: '0 0 25px rgba(34, 211, 238, 0.6)' }}>
                {gameState.roomOtp || '----'}
              </div>
              <p style={{ color: '#ccc', fontFamily: 'var(--modern-font)', fontSize: '0.95rem' }}>Share this 4-digit OTP on the main screen for players to enter!</p>
              <button onClick={() => adminAction('GENERATE_NEW_OTP')} className="retro-btn" style={{ marginTop: '12px', fontSize: '0.8rem', padding: '8px 16px', borderColor: 'var(--cyan)', color: 'var(--cyan)' }}>
                GENERATE NEW OTP 🔄
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '15px 25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '25px' }}>
              <span style={{ color: '#aaa', fontFamily: 'var(--modern-font)', fontSize: '1rem' }}>VERIFIED PLAYERS:</span>
              <span style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: '1.6rem' }}>
                {verifiedCount} / {totalPlayers}
              </span>
            </div>

            {/* Scrollable Player List */}
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '30px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
              {safePlayerList.length === 0 ? (
                <p style={{ color: '#666', fontFamily: 'var(--modern-font)' }}>No players connected yet...</p>
              ) : (
                safePlayerList.map(p => (
                  <div key={p.id} className="admin-player-chip" style={{ opacity: p.verified ? 1 : 0.4 }}>
                    <div className="chip-dot" style={{ background: p.verified ? 'var(--neon-green)' : '#666', boxShadow: p.verified ? '0 0 6px var(--neon-green)' : 'none' }} />
                    <span>{p.nickname}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ flex: 1, minWidth: '160px', borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', padding: '14px', fontSize: '0.85rem' }}>
                🎮 START GAME 1 (MEME WAR)
              </button>
              <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ flex: 1, minWidth: '160px', borderColor: 'var(--cyan)', color: 'var(--cyan)', padding: '14px', fontSize: '0.85rem' }}>
                🎵 START GAME 2 (MOVIE & SONG)
              </button>
              <button onClick={() => { fetchManagedQuestions(); setShowQuestionManager(true); }} className="retro-btn" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '14px', fontSize: '0.8rem' }}>
                ✏️ EDIT QUESTIONS
              </button>
              <button onClick={() => adminAction('KICK_UNVERIFIED')} className="retro-btn" style={{ borderColor: '#eab308', color: '#eab308', padding: '14px', fontSize: '0.8rem' }}>
                KICK UNVERIFIED
              </button>
              <button onClick={() => adminAction('RESET_LOBBY')} className="retro-btn" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '14px', fontSize: '0.8rem' }}>
                RESET LOBBY
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    const isVerified = myPlayer?.verified;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
      >
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', maxWidth: '550px', width: '100%', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)' }}>
          <div className="glass-badge" style={{ marginBottom: '20px', color: 'var(--hot-pink)' }}>ENTER OTP CODE</div>
          
          <h2 style={{ fontFamily: 'var(--retro-font)', color: '#fff', fontSize: '2rem', marginBottom: '15px' }}>
            PRESENCE CHECK
          </h2>

          {isVerified ? (
            <div style={{ marginTop: '30px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '15px' }}>✅</div>
              <h3 style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: '1.5rem', marginBottom: '15px' }}>VERIFIED & READY!</h3>
              <p style={{ color: '#aaa', fontFamily: 'var(--modern-font)', fontSize: '1rem' }}>You're confirmed in the arena. Waiting for the host to launch the game...</p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#ccc', fontFamily: 'var(--modern-font)', fontSize: '1.1rem', marginBottom: '30px', lineHeight: 1.6 }}>
                Enter the 4-digit OTP shown on the host screen to confirm your presence!
              </p>

              <form onSubmit={submitOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input 
                  type="text" 
                  maxLength={4}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="e.g. 1234"
                  style={{ textAlign: 'center', fontSize: '3rem', fontFamily: 'var(--retro-font)', letterSpacing: '15px', color: 'var(--cyan)', background: 'rgba(0,0,0,0.6)', border: '2px solid var(--cyan)', borderRadius: '16px', padding: '15px', outline: 'none' }}
                />

                {otpError && (
                  <p style={{ color: '#ef4444', fontFamily: 'var(--modern-font)', fontSize: '0.9rem' }}>{otpError}</p>
                )}

                <button type="submit" className="retro-btn" style={{ padding: '18px', fontSize: '1rem', borderColor: 'var(--neon-green)', color: 'var(--neon-green)' }}>
                  VERIFY PRESENCE ✋
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // ── Game View ─────────────────────────────────────────────────────────────
  const renderGame = () => {
    if (!safeCurrentQuestion) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontFamily: 'var(--retro-font)' }}>
          LOADING QUESTION...
        </div>
      );
    }

    // ADMIN VIEW
    if (isAdmin) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ minHeight: '100vh', padding: '30px 5%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(10,10,15,0.85)', padding: '20px 30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <span className="glass-badge" style={{ color: 'var(--cyan)', fontSize: '0.7rem' }}>HOST CONTROL CENTER</span>
              <h1 style={{ fontFamily: 'var(--retro-font)', color: '#fff', fontSize: '1.4rem', marginTop: '5px' }}>
                PHASE: {gameState.phase} — Q {(gameState.currentQuestionIndex || 0) + 1}/{gameState.totalQuestions || 20}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#aaa', fontSize: '0.75rem', fontFamily: 'var(--modern-font)' }}>TOTAL ANSWERS</p>
                <p style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: '1.8rem' }}>{safeAnalytics.totalAnswers} / {safePlayerCount}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px' }}>
            
            {/* Question Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <h3 style={{ color: 'var(--hot-pink)', fontFamily: 'var(--retro-font)', fontSize: '0.9rem' }}>CURRENT QUESTION</h3>
                  <TimerArc timeLeft={timeLeft} maxTime={maxTime} />
                </div>
                <h2 style={{ fontFamily: 'var(--modern-font)', fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>{safeCurrentQuestion ? safeCurrentQuestion.text : 'Waiting for next question...'}</h2>
                
                {safeCurrentQuestion?.image && (
                  safeCurrentQuestion.image.endsWith('.mp4') || safeCurrentQuestion.image.endsWith('.webm') ? (
                    <video src={safeCurrentQuestion.image} autoPlay loop muted playsInline style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }} />
                  ) : (
                    <img src={safeCurrentQuestion.image} alt="Meme" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }} />
                  )
                )}
              </div>

              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)' }}>
                <h3 style={{ color: 'var(--cyan)', fontFamily: 'var(--retro-font)', marginBottom: '18px', fontSize: '0.85rem' }}>LIVE ANSWER DISTRIBUTION</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {safeCurrentQuestion?.options?.map((opt, i) => {
                    const count = safeAnalytics.optionCounts?.[i] || 0;
                    const total = Math.max(1, safeAnalytics.totalAnswers);
                    const percent = Math.min(100, Math.round((count / total) * 100));
                    const isCorrect = safeAnalytics.correctOption === i;
                    
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '140px', fontFamily: 'var(--modern-font)', fontSize: '0.9rem', color: isCorrect ? 'var(--neon-green)' : '#ccc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: isCorrect ? 700 : 400 }}>
                          {isCorrect ? '✓ ' : ''}{opt}
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', height: '22px', borderRadius: '11px', overflow: 'hidden' }}>
                          <div 
                            className={isCorrect ? 'answer-bar-correct' : 'answer-bar-default'}
                            style={{ width: `${percent}%`, height: '100%', transition: 'width 0.4s ease', borderRadius: '11px' }} 
                          />
                        </div>
                        <div style={{ width: '45px', textAlign: 'right', fontFamily: 'var(--retro-font)', fontSize: '0.75rem', color: isCorrect ? 'var(--neon-green)' : 'var(--cyan)' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Fastest Fingers & Host Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)' }}>
                <h3 style={{ color: 'gold', fontFamily: 'var(--retro-font)', marginBottom: '18px', fontSize: '0.85rem' }}>⚡ FASTEST FINGERS TOP 5</h3>
                {safeAnalytics.fastestFingers?.length === 0 ? (
                  <p style={{ color: '#666', fontFamily: 'var(--modern-font)' }}>Waiting for correct answers...</p>
                ) : (
                  safeAnalytics.fastestFingers?.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#fff', fontFamily: 'var(--modern-font)', fontSize: '0.9rem', fontWeight: 600 }}>{idx + 1}. {f.nickname}</span>
                      <span style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', fontSize: '0.85rem' }}>{f.timeTaken}s</span>
                    </div>
                  ))
                )}
              </div>

              <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.8)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => adminAction('NEXT_QUESTION')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', fontSize: '0.9rem', padding: '10px 15px', width: '100%', marginBottom: '5px' }}>NEXT QUESTION ➔</button>
                <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ fontSize: '0.75rem', padding: '8px 12px' }}>↺ GAME 1</button>
                <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ fontSize: '0.75rem', padding: '8px 12px' }}>🎵 GAME 2</button>
                <button onClick={() => { fetchManagedQuestions(); setShowQuestionManager(true); }} className="retro-btn" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', fontSize: '0.75rem', padding: '8px 12px' }}>✏️ EDIT QUESTIONS</button>
                <button onClick={() => adminAction('SHOW_LEADERBOARD')} className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', fontSize: '0.75rem', padding: '8px 12px' }}>🏆 LEADERBOARD</button>
                <button onClick={() => adminAction('STOP_GAME')} className="retro-btn" style={{ borderColor: '#ef4444', color: '#ef4444', fontSize: '0.75rem', padding: '8px 12px', width: '100%', marginTop: '5px' }}>🛑 STOP & RESET</button>
              </div>
            </div>

          </div>
        </motion.div>
      );
    }

    // PLAYER VIEW
    const myPlayer = safeMyPlayer;
    const myScore = myPlayer?.score ?? 0;
    const hasAnswered = selectedOption !== null;

    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}
      >
        {/* Top HUD: Score & Progress */}
        <div className="score-hud">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.65rem', color: '#aaa', letterSpacing: '1px' }}>QUESTION</span>
            <span style={{ fontFamily: 'var(--retro-font)', fontSize: '0.8rem', color: 'var(--cyan)' }}>
              {(gameState.currentQuestionIndex || 0) + 1}/{gameState.totalQuestions || 20}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', key: scoreAnimKey }}>
            <span style={{ fontSize: '0.65rem', color: '#aaa', letterSpacing: '1px' }}>YOUR SCORE</span>
            <span className="scorePop" style={{ fontFamily: 'var(--retro-font)', fontSize: '1.2rem', color: 'gold' }}>
              {myScore} PTS
            </span>
          </div>
        </div>

        {/* Question & Options Card */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="glass-card" style={{ textAlign: 'center', maxWidth: '800px', width: '100%', padding: '40px', background: 'rgba(10,10,15,0.85)' }}>
            
            {/* Timer arc */}
            <TimerArc timeLeft={timeLeft} maxTime={maxTime} />

            {safeCurrentQuestion.image && (
              safeCurrentQuestion.image.endsWith('.mp4') || safeCurrentQuestion.image.endsWith('.webm') ? (
                <video src={safeCurrentQuestion.image} autoPlay loop muted playsInline style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', marginBottom: '20px', borderRadius: '15px', border: '2px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <img src={safeCurrentQuestion.image} alt="Meme Reference" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', marginBottom: '20px', borderRadius: '15px', border: '2px solid rgba(255,255,255,0.1)' }} />
              )
            )}

            <h3 style={{ marginBottom: '30px', lineHeight: '1.6', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--modern-font)', color: '#fff' }}>{safeCurrentQuestion.text}</h3>
            
            {/* Answer result overlay */}
            {answerResult ? (
              <div className="result-overlay">
                <div style={{ marginBottom: '12px' }}>
                  {selectedOption === answerResult.correctOption ? (
                    <p style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', fontSize: '1rem' }}>✅ CORRECT! +{timeLeft * 10} pts</p>
                  ) : (
                    <p style={{ fontFamily: 'var(--retro-font)', color: '#ef4444', fontSize: '1rem' }}>❌ WRONG ANSWER</p>
                  )}
                </div>
                <p style={{ color: '#888', fontFamily: 'var(--modern-font)', fontSize: '0.9rem' }}>
                  Correct answer: <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{safeCurrentQuestion.options?.[answerResult.correctOption]}</span>
                </p>
                <p style={{ color: '#555', fontFamily: 'var(--modern-font)', fontSize: '0.8rem', marginTop: '10px' }}>Waiting for host to proceed...</p>
              </div>
            ) : hasAnswered ? (
              <div className="answer-locked-box">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</div>
                <p style={{ fontFamily: 'var(--retro-font)', color: 'var(--cyan)', fontSize: '0.85rem', marginBottom: '6px' }}>ANSWER LOCKED IN!</p>
                <p style={{ fontFamily: 'var(--modern-font)', color: '#aaa', fontSize: '0.9rem' }}>Waiting for others<span className="waiting-dots"><span>.</span><span>.</span><span>.</span></span></p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
                {safeCurrentQuestion.options?.map((opt, idx) => (
                  <motion.button 
                    key={idx}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => submitAnswer(idx)}
                    className="retro-btn option-btn"
                    style={{ fontSize: '0.95rem', padding: '18px 24px', textTransform: 'none', background: 'rgba(255,255,255,0.05)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <span style={{ color: 'var(--cyan)', fontFamily: 'var(--retro-font)', fontSize: '0.8rem' }}>{String.fromCharCode(65 + idx)}.</span>
                    <span>{opt}</span>
                  </motion.button>
                ))}
              </div>
            )}

          </div>
        </div>
      </motion.div>
    );
  };

  // ── Leaderboard View ─────────────────────────────────────────────────────
  const renderLeaderboard = () => {
    const leaderboard = gameState.leaderboard || [];

    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="glass-badge" style={{ marginBottom: '15px', color: 'gold' }}>HALL OF FAME</div>
          <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '3rem', color: '#fff', textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>FINAL STANDINGS</h1>
        </div>

        <div className="glass-card" style={{ maxWidth: '700px', width: '100%', padding: '40px', background: 'rgba(10,10,15,0.85)' }}>
          {leaderboard.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', fontFamily: 'var(--modern-font)' }}>No scores recorded yet...</p>
          ) : (
            leaderboard.map((p, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const isTop3 = idx < 3;
              const medal = medals[idx] || `#${idx + 1}`;
              const isMe = p.nickname === nickname;

              return (
                <motion.div key={p.id || idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className={isTop3 ? `leaderboard-row top-3 rank-${idx + 1}` : 'leaderboard-row'} style={{ border: isMe ? '2px solid var(--cyan)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span className="rank-badge">{medal}</span>
                    <span style={{ color: isMe ? 'var(--cyan)' : '#fff', fontWeight: isMe ? 800 : 600 }}>{p.nickname} {isMe ? '(YOU)' : ''}</span>
                  </div>
                  <span style={{ color: 'gold', fontFamily: 'var(--retro-font)', fontSize: '1rem' }}>{p.score} PTS</span>
                </motion.div>
              );
            })
          )}
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '15px', marginTop: '35px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', padding: '15px 25px', fontSize: '0.9rem' }}>
              START GAME 1 (MEME WAR) 🧠
            </button>
            <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', padding: '15px 25px', fontSize: '0.9rem' }}>
              START GAME 2 (MOVIE & SONG) 🎵
            </button>
            <button onClick={() => { fetchManagedQuestions(); setShowQuestionManager(true); }} className="retro-btn" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '15px 25px', fontSize: '0.9rem' }}>
              ✏️ EDIT & MANAGE QUESTIONS
            </button>
            <button onClick={() => adminAction('START_VERIFICATION')} className="retro-btn" style={{ borderColor: 'gold', color: 'gold', padding: '15px 25px', fontSize: '0.9rem' }}>
              NEW PRESENCE CHECK ✋
            </button>
            <button onClick={() => { setUiView('LANDING'); adminAction('RESET_LOBBY'); }} className="retro-btn" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '15px 25px', fontSize: '0.9rem' }}>
              RESET & EXIT 🛑
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="crt">
      {!isRevealed && (
        <PokemonReveal onComplete={() => setIsRevealed(true)} />
      )}

      <video 
        autoPlay 
        loop 
        muted 
        playsInline 
        className="video-bg"
      >
        <source src="/Floating_island_with_letter_A_202608202102_gwr_video_mvp.mp4" type="video/mp4" />
      </video>

      {uiView === 'LANDING' && renderLandingPage()}
      {uiView === 'ENTER_GAME' && renderEnterGame()}
      {uiView === 'ADMIN_LOGIN' && renderAdminLogin()}

      {uiView === 'JOINED' && (
        <>
          {(gameState?.phase === 'LOBBY' || !gameState?.phase) && renderJoinedLobby()}
          {gameState?.phase === 'VERIFICATION' && renderVerificationPage()}
          {['GAME1', 'GAME2'].includes(gameState?.phase) && renderGame()}
          {gameState?.phase === 'LEADERBOARD' && renderLeaderboard()}
        </>
      )}

      {/* Admin Question Manager Modal */}
      {isAdmin && renderQuestionManagerModal()}

      {/* Music toggle */}
      <button 
        onClick={toggleMusic} 
        className="music-toggle-btn"
      >
        {isMusicPlaying ? '🔊 MUSIC ON' : '🔈 MUSIC OFF'}
      </button>
      <audio ref={audioRef} src="/bg-music.mp3" loop onError={() => {}} />
    </div>
  );
}

export default App;
