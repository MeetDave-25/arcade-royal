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
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) { /* silently fail */ }
  };

  useEffect(() => {
    socket.on('gameStateUpdate', (state) => {
      setGameState(state);
      setAnswerResult(null); 
      setSelectedOption(null);
    });

    socket.on('liveAnalytics', (analytics) => {
      setLiveAnalytics(analytics);
    });

    socket.on('question', (q) => {
      setGameState(prev => ({ ...prev, currentQuestion: q }));
      setAnswerResult(null);
      setSelectedOption(null);
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
      } else {
        setAdminLoginError(res.error || 'Incorrect password!');
      }
    });
  };

  const submitAnswer = (index) => {
    if (selectedOption !== null || answerResult) return;
    setSelectedOption(index);
    socket.emit('submitAnswer', index);
  };

  const adminAction = (action) => {
    socket.emit('adminAction', action);
  };

  const handleSubmitOtp = (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.trim() === '') return;
    socket.emit('verifyOtp', otpInput.trim());
  };

  // ── Landing Page ──────────────────────────────────────────────────────────
  const renderLandingPage = () => (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden' }}>
      
      <div className="video-overlay-radial" />
      <div className="video-overlay-linear" />

      {/* Header / Navigation */}
      <nav className="app-navbar">
        <div className="navbar-top-row">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.6 }}
            className="navbar-brand"
          >
            <img src="/favicon.svg" alt="Arcade Royale Logo" className="navbar-logo" />
            <span className="navbar-title">
              ARCADE <span style={{ color: 'var(--cyan)' }}>ROYALE</span>
            </span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="navbar-actions"
          >
            <button onClick={() => setUiView('ADMIN_LOGIN')} className="navbar-btn-ghost">
              Host Login
            </button>
            <button onClick={() => setUiView('ENTER_GAME')} className="navbar-btn-primary">
              Join Now
            </button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -5 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="nav-center-links"
        >
          {['ARENA', 'MODES', 'POSTER', 'LEADERBOARD'].map((link, idx) => (
            <a key={idx} href={`#${link.toLowerCase()}`}>
              {link}
            </a>
          ))}
        </motion.div>
      </nav>


      {/* Hero Section */}
      <header id="arena" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '130px 5% 50px 5%', position: 'relative', zIndex: 10 }}>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '900px' }}
        >
          <div className="glass-badge">✦ LEVEL 99 RETRO SHOWDOWN</div>

          <h1 className="hero-headline" style={{ marginTop: '25px', marginBottom: '20px' }}>
            THE ULTIMATE REAL-TIME <br/>
            <span className="italic-word">ARCADE</span> SHOWDOWN
          </h1>


          <p style={{ fontFamily: 'var(--body-font)', fontSize: '1.25rem', fontWeight: 300, color: '#9ca3af', lineHeight: 1.7, marginBottom: '45px', maxWidth: '650px' }}>
            A massive 100-player retro showdown. Test your reflexes, your meme knowledge, and your will to win in an immersive digital arena.
          </p>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
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
      <section id="modes" style={{ padding: '120px 5%', position: 'relative', zIndex: 10 }}>
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <div className="glass-badge" style={{ marginBottom: '15px' }}>CHALLENGE MODES</div>
          <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: '3rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
            CHOOSE YOUR <span style={{ color: 'var(--cyan)' }}>DESTINY</span>
          </h2>
        </motion.div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', maxWidth: '1400px', margin: '0 auto' }}>
          
          {[
            { icon: '🧠', title: 'Meme War', desc: 'Test your knowledge of internet culture, viral videos, and legendary Bollywood memes. Answer fast to secure maximum points.', color: 'var(--cyan)' },
            { icon: '😂', title: 'Comedy Edition', desc: 'We pause the viral clip right before the punchline. You guess the ridiculous ending. It\'s absolute comedy gold.', color: 'var(--neon-green)' },
            { icon: '⚔️', title: 'Marathon Boss', desc: 'The final stage. Rapid fire questions, higher difficulty, and double the points. Only the strong survive the onslaught.', color: 'var(--hot-pink)' },
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
              src="/psoter1.png" alt="Retro Poster" 
              className="glass-card"
              style={{ y: yParallax, width: '100%', maxWidth: '480px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.15)', padding: 0 }} 
            />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            style={{ flex: '1 1 500px', background: 'rgba(255,255,255,0.02)', padding: '50px', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="glass-badge" style={{ marginBottom: '20px' }}>ARENA SHOWDOWN</div>
            <h2 style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: '3rem', color: '#fff', marginBottom: '25px', lineHeight: '1.1' }}>
              READY TO <br/><span className="gradient-text">DOMINATE?</span>
            </h2>
            <p style={{ fontFamily: 'var(--body-font)', fontWeight: 300, lineHeight: '1.8', color: '#9ca3af', marginBottom: '40px', fontSize: '1.1rem' }}>
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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '60px', textAlign: 'center', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)' }}>
        <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', marginBottom: '40px', color: 'var(--cyan)' }}>INSERT COIN</h1>
        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <input 
            type="text" 
            className="retro-input" 
            placeholder="ENTER NICKNAME" 
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={15}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '15px' }}>
            <button type="button" onClick={() => setUiView('LANDING')} className="retro-btn" style={{ border: '2px solid #555', color: '#aaa', background: 'transparent', flex: 1, boxShadow: 'none' }}>BACK</button>
            <button type="submit" className="retro-btn" style={{ flex: 2 }} disabled={!nickname.trim()}>JOIN LOBBY</button>
          </div>
        </form>
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: 'var(--modern-font)', fontSize: '0.75rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Built By <span className="gradient-text" style={{ fontWeight: 900, marginLeft: '5px' }}>MEET G. DAVE</span>
          </div>
          <p style={{ color: '#555', fontSize: '0.7rem', fontFamily: 'var(--modern-font)', marginTop: '8px' }}>@2026 AiRA Lab</p>
        </div>
      </div>
    </motion.div>
  );

  // ── Admin Login ────────────────────────────────────────────────────────────
  const renderAdminLogin = () => (
    <motion.div 
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '60px', textAlign: 'center', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)' }}>
        <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', color: 'var(--hot-pink)', marginBottom: '40px' }}>HOST LOGIN</h1>
        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="password" 
            className="retro-input" 
            placeholder="ENTER PASSWORD" 
            value={adminPassword}
            onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(''); }}
            style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)' }}
            autoFocus
          />
          {adminLoginError && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#ef4444', fontFamily: 'var(--modern-font)', fontSize: '0.95rem', fontWeight: 600 }}>
              ⚠️ {adminLoginError}
            </motion.p>
          )}
          <div style={{ display: 'flex', gap: '15px' }}>
            <button type="button" onClick={() => setUiView('LANDING')} className="retro-btn" style={{ border: '2px solid #555', color: '#aaa', background: 'transparent', flex: 1, boxShadow: 'none' }}>BACK</button>
            <button type="submit" className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', flex: 2 }}>LOGIN</button>
          </div>
        </form>
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: 'var(--modern-font)', fontSize: '0.75rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Built By <span className="gradient-text" style={{ fontWeight: 900, marginLeft: '5px' }}>MEET G. DAVE</span>
          </div>
          <p style={{ color: '#555', fontSize: '0.7rem', fontFamily: 'var(--modern-font)', marginTop: '8px' }}>@2026 AiRA Lab</p>
        </div>
      </div>
    </motion.div>
  );

  // ── Joined Lobby ──────────────────────────────────────────────────────────
  const renderJoinedLobby = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px', maxWidth: '700px', width: '100%', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)' }}>
        {isAdmin ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', marginBottom: '5px', fontSize: '2rem' }}>ADMIN DASHBOARD</h2>
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '15px', padding: '20px 30px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '1rem', color: '#ccc', fontFamily: 'var(--modern-font)' }}>Connected Players</p>
                <p className="gradient-text" style={{ fontSize: '4rem', margin: '5px 0', fontFamily: 'var(--retro-font)' }}>{safePlayerCount}</p>
              </div>
              <div style={{ width: '1px', height: '60px', background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <p style={{ fontSize: '1rem', color: '#ccc', fontFamily: 'var(--modern-font)' }}>Status</p>
                <p style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: '1.2rem', marginTop: '5px' }}>LOBBY</p>
              </div>
            </div>

            {/* Live player list */}
            {safePlayerList.length > 0 && (
              <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {safePlayerList.map(p => (
                  <div key={p.id} className="admin-player-chip">
                    <span className="chip-dot" />
                    {p.nickname}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => adminAction('START_VERIFICATION')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', padding: '15px', fontSize: '0.9rem', flex: 1, minWidth: '180px' }}>
                VERIFY PRESENCE ✋
              </button>
              <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', padding: '15px', fontSize: '0.9rem', flex: 1, minWidth: '180px' }}>
                START ARCADE 🚀
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

            {/* Stats */}
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '15px', padding: '20px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#aaa', fontFamily: 'var(--modern-font)', fontSize: '0.9rem' }}>VERIFIED PLAYERS</p>
                <p className="gradient-text" style={{ fontSize: '3rem', fontFamily: 'var(--retro-font)', margin: '5px 0' }}>{verifiedCount} / {totalPlayers}</p>
              </div>
              <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <p style={{ color: '#aaa', fontFamily: 'var(--modern-font)', fontSize: '0.9rem' }}>STATUS</p>
                <p style={{ color: verifiedCount === totalPlayers && totalPlayers > 0 ? 'var(--neon-green)' : 'gold', fontSize: '1.3rem', fontFamily: 'var(--retro-font)', marginTop: '5px' }}>
                  {verifiedCount === totalPlayers && totalPlayers > 0 ? 'ALL READY!' : 'CHECKING...'}
                </p>
              </div>
            </div>

            {/* Player grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', maxHeight: '180px', overflowY: 'auto', padding: '10px', marginBottom: '25px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {safePlayerList.length === 0 ? (
                <p style={{ color: '#888', gridColumn: '1 / -1', padding: '20px' }}>No players in lobby</p>
              ) : (
                safePlayerList.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: p.verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: p.verified ? '1px solid var(--neon-green)' : '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontFamily: 'var(--modern-font)', fontWeight: 700, color: '#fff', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nickname}</span>
                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--retro-font)', color: p.verified ? 'var(--neon-green)' : '#888' }}>
                      {p.verified ? '✅' : '⏳'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ flex: 1, minWidth: '140px', borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', padding: '14px', fontSize: '0.85rem' }}>
                🎮 START GAME 1
              </button>
              <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ flex: 1, minWidth: '140px', borderColor: 'var(--cyan)', color: 'var(--cyan)', padding: '14px', fontSize: '0.85rem' }}>
                😂 START GAME 2
              </button>
              <button onClick={() => adminAction('START_GAME3')} className="retro-btn" style={{ flex: 1, minWidth: '140px', borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '14px', fontSize: '0.85rem' }}>
                ⚡ START GAME 3
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

          <p style={{ fontFamily: 'var(--modern-font)', color: '#ccc', fontSize: '1rem', marginBottom: '30px', lineHeight: '1.6' }}>
            Enter the 4-digit OTP shown on the Host screen to verify your presence!
          </p>

          {isVerified ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'rgba(34, 197, 94, 0.15)', border: '2px solid var(--neon-green)', padding: '30px', borderRadius: '16px', boxShadow: '0 0 30px rgba(34, 197, 94, 0.2)' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
              <h3 style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', fontSize: '1.4rem', marginBottom: '10px' }}>VERIFIED WITH OTP!</h3>
              <p style={{ fontFamily: 'var(--modern-font)', color: '#aaa', fontSize: '0.95rem' }}>Waiting for host to start the game round...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmitOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <input 
                type="text" 
                maxLength={4}
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/[^0-9]/g, ''));
                  setOtpError('');
                }}
                placeholder="0000"
                className="retro-input"
                style={{ textAlign: 'center', fontSize: '2.5rem', letterSpacing: '10px', width: '220px', padding: '15px', color: 'var(--cyan)', borderColor: 'var(--cyan)' }}
                autoFocus
              />
              {otpError && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{ color: '#ef4444', fontFamily: 'var(--modern-font)', fontSize: '0.95rem', fontWeight: 600 }}>
                  ⚠️ {otpError}
                </motion.p>
              )}
              <button type="submit" className="retro-btn" style={{ width: '100%', padding: '20px', fontSize: '1.2rem', borderColor: 'var(--neon-green)', color: 'var(--neon-green)', background: 'rgba(34, 197, 94, 0.15)' }}>
                VERIFY OTP ✋
              </button>
            </form>
          )}

          <div style={{ marginTop: '30px', color: '#666', fontFamily: 'var(--modern-font)', fontSize: '0.85rem' }}>
            PLAYER: <span style={{ color: '#fff', fontWeight: 700 }}>{nickname}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Game View ──────────────────────────────────────────────────────────────
  const renderGame = () => {
    const totalQ = gameState?.totalQuestions || 0;
    const currentQIdx = (gameState?.currentQuestionIndex ?? 0) + 1;

    if (isAdmin) {
      return (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px' }}>
            <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', color: '#fff', textShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>ADMIN ANALYTICS</h1>
            {totalQ > 0 && (
              <div className="q-progress-badge">Q {currentQIdx} / {totalQ}</div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', width: '100%', maxWidth: '1200px' }}>
            
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <h3 style={{ color: 'var(--hot-pink)', fontFamily: 'var(--retro-font)', fontSize: '0.9rem' }}>CURRENT QUESTION</h3>
                  <TimerArc timeLeft={timeLeft} maxTime={maxTime} />
                </div>
                <h2 style={{ fontFamily: 'var(--modern-font)', fontSize: '1.4rem', fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>{safeCurrentQuestion ? safeCurrentQuestion.text : 'Waiting for next question...'}</h2>
                
                {safeCurrentQuestion?.image && (
                  <img src={safeCurrentQuestion.image} alt="Meme" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }} />
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

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--modern-font)', color: '#aaa', fontSize: '1.1rem' }}>TOTAL RESPONSES</div>
                <div style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', color: 'var(--neon-green)' }}>{safeAnalytics.totalAnswers} <span style={{ fontSize: '1rem', color: '#555' }}>/ {safePlayerCount}</span></div>
              </div>

              <div className="glass-card" style={{ padding: '28px', background: 'rgba(10,10,15,0.9)', flex: 1 }}>
                <h3 style={{ color: 'gold', fontFamily: 'var(--retro-font)', marginBottom: '18px', fontSize: '0.85rem' }}>⚡ FASTEST FINGERS</h3>
                {!safeAnalytics.fastestFingers || safeAnalytics.fastestFingers.length === 0 ? (
                  <p style={{ color: '#555', fontFamily: 'var(--modern-font)' }}>Waiting for correct answers...</p>
                ) : (
                  safeAnalytics.fastestFingers.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontFamily: 'var(--modern-font)', fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {f.nickname}</span>
                      <span style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', fontSize: '0.85rem' }}>{f.timeTaken}s</span>
                    </div>
                  ))
                )}
              </div>

              <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.8)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => adminAction('NEXT_QUESTION')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', fontSize: '0.9rem', padding: '10px 15px', width: '100%', marginBottom: '5px' }}>NEXT QUESTION ➔</button>
                <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ fontSize: '0.75rem', padding: '8px 12px' }}>↺ GAME 1</button>
                <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ fontSize: '0.75rem', padding: '8px 12px' }}>G2 COMEDY</button>
                <button onClick={() => adminAction('START_GAME3')} className="retro-btn" style={{ fontSize: '0.75rem', padding: '8px 12px' }}>G3 MARATHON</button>
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
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}
      >
        {/* Score HUD */}
        <div className="score-hud glass-card" style={{ position: 'fixed', top: 20, right: 20, textAlign: 'right', padding: '12px 20px', background: 'rgba(10,10,15,0.8)', zIndex: 50 }}>
           <p style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '4px', fontFamily: 'var(--modern-font)' }}>PLAYER: <span style={{ color: '#fff' }}>{nickname}</span></p>
           <p key={scoreAnimKey} className="score-pop" style={{ color: 'var(--neon-green)', fontSize: '1.2rem', fontFamily: 'var(--retro-font)' }}>SCORE: {myScore}</p>
        </div>

        {/* Progress Badge */}
        {totalQ > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div className="q-progress-badge">Q {currentQIdx} / {totalQ}</div>
          </div>
        )}
        
        {safeCurrentQuestion ? (
          <div className="glass-card" style={{ textAlign: 'center', maxWidth: '800px', width: '100%', padding: '40px', background: 'rgba(10,10,15,0.85)' }}>
            
            {/* Timer arc */}
            <TimerArc timeLeft={timeLeft} maxTime={maxTime} />

            {safeCurrentQuestion.image && (
              <img src={safeCurrentQuestion.image} alt="Meme Reference" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', marginBottom: '20px', borderRadius: '15px', border: '2px solid rgba(255,255,255,0.1)' }} />
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
              <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {safeCurrentQuestion.options?.map((opt, i) => (
                  <button 
                    key={i} 
                    className="retro-btn" 
                    style={{ fontSize: '1rem', padding: '20px', fontFamily: 'var(--modern-font)', fontWeight: 700, transition: 'all 0.2s' }}
                    onClick={() => submitAnswer(i)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <motion.h2 animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="gradient-text" style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem' }}>PREPARING QUESTION...</motion.h2>
        )}
      </motion.div>
    );
  };



  // ── Leaderboard ───────────────────────────────────────────────────────────
  const renderLeaderboard = () => {
    const MEDALS = ['🥇', '🥈', '🥉'];
    const ROW_CLASSES = ['lb-row-gold', 'lb-row-silver', 'lb-row-bronze', 'lb-row-default'];
    const NAME_COLORS = ['#fbbf24', '#9ca3af', '#b47c3c', '#ffffff'];

    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 20px' }}
      >
        <h1 className="gradient-text" style={{ fontFamily: 'var(--retro-font)', fontSize: '3.5rem', marginBottom: '40px', textShadow: '0 5px 15px rgba(0,0,0,0.8)', textAlign: 'center' }}>FINAL STANDINGS</h1>
        <div className="glass-card" style={{ padding: '40px', width: '100%', maxWidth: '800px', background: 'rgba(10,10,15,0.8)' }}>
          {gameState?.leaderboard && gameState.leaderboard.map((p, i) => (
            <motion.div 
              key={p.id} 
              initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className={ROW_CLASSES[Math.min(i, 3)]}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontFamily: 'var(--retro-font)', fontSize: i < 3 ? '2rem' : '1.2rem', color: i < 3 ? NAME_COLORS[i] : '#555', minWidth: '40px', textAlign: 'center' }}>
                  {i < 3 ? MEDALS[i] : `${i + 1}.`}
                </span>
                <span style={{ fontFamily: 'var(--modern-font)', fontWeight: 700, fontSize: i === 0 ? '1.8rem' : i < 3 ? '1.5rem' : '1.3rem', color: NAME_COLORS[Math.min(i, 3)] }}>
                  {p.nickname}
                </span>
              </div>
              <span style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: i === 0 ? '2rem' : '1.5rem' }}>{p.score}</span>
            </motion.div>
          ))}
          {(!gameState?.leaderboard || gameState.leaderboard.length === 0) && (
            <p style={{ color: '#555', fontFamily: 'var(--modern-font)', textAlign: 'center', padding: '40px' }}>No scores yet...</p>
          )}
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '15px', marginTop: '35px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', padding: '15px 25px', fontSize: '0.9rem' }}>
              START GAME 2 😂
            </button>
            <button onClick={() => adminAction('START_GAME3')} className="retro-btn" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '15px 25px', fontSize: '0.9rem' }}>
              START GAME 3 ⚡
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
          {['GAME1', 'GAME2', 'GAME3'].includes(gameState?.phase) && renderGame()}
          {gameState?.phase === 'LEADERBOARD' && renderLeaderboard()}
        </>
      )}

      {/* Music toggle */}
      <button 
        onClick={toggleMusic} 
        style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1000, background: 'rgba(0,0,0,0.6)', border: '1px solid var(--cyan)', color: 'var(--cyan)', padding: '10px 20px', borderRadius: '50px', cursor: 'pointer', backdropFilter: 'blur(10px)', fontFamily: 'var(--modern-font)', fontSize: '0.85rem', fontWeight: 700, transition: 'all 0.3s' }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(34,211,238,0.15)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
      >
        {isMusicPlaying ? '🔊 MUSIC ON' : '🔈 MUSIC OFF'}
      </button>
      <audio ref={audioRef} src="/bg-music.mp3" loop onError={() => {}} />
    </div>
  );
}

export default App;
