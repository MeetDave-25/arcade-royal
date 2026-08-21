import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, useScroll, useTransform } from 'framer-motion';
import PokemonReveal from './PokemonReveal';
import './index.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

function App() {
  const [isRevealed, setIsRevealed] = useState(false);
  const [gameState, setGameState] = useState({ phase: 'LOBBY', players: {}, leaderboard: [] });
  const [liveAnalytics, setLiveAnalytics] = useState({ totalAnswers: 0, optionCounts: [0,0,0,0], fastestFingers: [] });
  
  // UI States
  const [uiView, setUiView] = useState('LANDING'); // LANDING, ENTER_GAME, ADMIN_LOGIN, JOINED
  const [nickname, setNickname] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Game States
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerResult, setAnswerResult] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  
  // Music State
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef(null);

  const toggleMusic = () => {
    if (isMusicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -200]);

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

    return () => {
      socket.off('gameStateUpdate');
      socket.off('liveAnalytics');
      socket.off('question');
      socket.off('timer');
      socket.off('answerResult');
    };
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    if (nickname.trim() === '') return;
    socket.emit('joinGame', nickname);
    setUiView('JOINED');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { 
      setIsAdmin(true);
      setUiView('JOINED');
    } else {
      alert('Incorrect Admin Password!');
    }
  };

  const submitAnswer = (index) => {
    if (selectedOption !== null || answerResult) return;
    setSelectedOption(index);
    socket.emit('submitAnswer', index);
  };

  const adminAction = (action) => {
    socket.emit('adminAction', action);
  };

  const renderLandingPage = () => (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Video Overlays */}
      <div className="video-overlay-radial" />
      <div className="video-overlay-linear" />

      {/* Header / Navigation */}
      <nav style={{ position: 'fixed', top: 0, left: 0, width: '100%', padding: '24px 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', alignItems: 'center', gap: '15px' }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ffffff', color: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--retro-font)', boxShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
            A
          </div>
          <span style={{ fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '0.15em', color: '#ffffff' }}>
            ARCADE <span style={{ color: 'var(--cyan)' }}>ROYALE</span>
          </span>
        </motion.div>

        {/* Center Nav Links */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          style={{ display: 'flex', gap: '40px', alignItems: 'center' }}
        >
          {['ARENA', 'MODES', 'POSTER', 'LEADERBOARD'].map((link, idx) => (
            <a 
              key={idx} 
              href={`#${link.toLowerCase()}`}
              style={{ fontFamily: 'var(--body-font)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9ca3af', textDecoration: 'none', transition: 'color 0.3s' }}
              onMouseOver={(e) => e.target.style.color = '#ffffff'}
              onMouseOut={(e) => e.target.style.color = '#9ca3af'}
            >
              {link}
            </a>
          ))}
        </motion.div>

        {/* Right CTA */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', gap: '20px', alignItems: 'center' }}
        >
          <button 
            onClick={() => setUiView('ADMIN_LOGIN')} 
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '9999px', padding: '10px 24px', color: '#ffffff', fontFamily: 'var(--body-font)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s' }}
            onMouseOver={(e) => { e.target.style.background = '#ffffff'; e.target.style.color = '#000000'; }}
            onMouseOut={(e) => { e.target.style.background = 'transparent'; e.target.style.color = '#ffffff'; }}
          >
            Host Login
          </button>
          <button 
            onClick={() => setUiView('ENTER_GAME')} 
            className="magnetic-btn-primary"
            style={{ padding: '10px 24px', fontSize: '0.8rem' }}
          >
            <div className="bg-hover" />
            <span>Join Now</span>
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <header style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '140px 5% 60px 5%', position: 'relative', zIndex: 10 }}>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '900px' }}
        >
          {/* Glass Status Badge */}
          <div className="glass-badge">
            ✦ LEVEL 99 RETRO SHOWDOWN
          </div>

          {/* Headline */}
          <h1 className="hero-headline" style={{ marginTop: '30px', marginBottom: '25px' }}>
            SURVIVE THE <br/>
            <span className="italic-word">ARCADE</span> SHOWDOWN
          </h1>

          {/* Description */}
          <p style={{ fontFamily: 'var(--body-font)', fontSize: '1.25rem', fontWeight: 300, color: '#9ca3af', lineHeight: 1.7, marginBottom: '45px', maxWidth: '650px' }}>
            A massive 100-player retro showdown. Test your reflexes, your meme knowledge, and your will to win in an immersive digital arena.
          </p>

          {/* CTA Group */}
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

        {/* Scroll Indicator */}
        <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="scroll-indicator-line" />
        </div>
      </header>

      {/* Game Modes Cards */}
      <section id="modes" style={{ padding: '120px 5%', position: 'relative', zIndex: 10, background: 'transparent' }}>
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
          
          <motion.div 
            className="glass-card" 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ padding: '45px', borderTop: '2px solid var(--cyan)', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(16px)' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🧠</div>
            <h3 style={{ fontFamily: 'var(--display-font)', fontWeight: 700, color: '#fff', marginBottom: '12px', fontSize: '1.6rem' }}>Meme War</h3>
            <p style={{ fontFamily: 'var(--body-font)', lineHeight: '1.7', color: '#9ca3af', fontSize: '1rem', fontWeight: 300 }}>Test your knowledge of internet culture, viral videos, and legendary memes. Answer fast to secure maximum points.</p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ padding: '45px', borderTop: '2px solid var(--neon-green)', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(16px)' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>😂</div>
            <h3 style={{ fontFamily: 'var(--display-font)', fontWeight: 700, color: '#fff', marginBottom: '12px', fontSize: '1.6rem' }}>Comedy Edition</h3>
            <p style={{ fontFamily: 'var(--body-font)', lineHeight: '1.7', color: '#9ca3af', fontSize: '1rem', fontWeight: 300 }}>We pause the viral clip right before the punchline. You guess the ridiculous ending. It's absolute comedy gold.</p>
          </motion.div>

          <motion.div 
            className="glass-card" 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ padding: '45px', borderTop: '2px solid var(--hot-pink)', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(16px)' }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>⚔️</div>
            <h3 style={{ fontFamily: 'var(--display-font)', fontWeight: 700, color: '#fff', marginBottom: '12px', fontSize: '1.6rem' }}>Marathon Boss</h3>
            <p style={{ fontFamily: 'var(--body-font)', lineHeight: '1.7', color: '#9ca3af', fontSize: '1rem', fontWeight: 300 }}>The final stage. Rapid fire questions, higher difficulty, and double the points. Only the strong survive the onslaught.</p>
          </motion.div>
        </div>
      </section>

      {/* Poster Section */}
      <section id="poster" style={{ padding: '100px 5%', position: 'relative', zIndex: 10, background: 'transparent' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '60px', maxWidth: '1400px', margin: '0 auto' }}>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}
          >
            <motion.img 
              style={{ y: yParallax }} 
              src="/psoter1.png" alt="Retro Poster" 
              className="glass-card"
              style={{ width: '100%', maxWidth: '480px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.15)', padding: 0 }} 
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

      {/* Cinematic Luxury Footer */}
      <footer style={{ padding: '40px 5%', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)', position: 'relative', zIndex: 10, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
        
        {/* Social Links Left */}
        <div style={{ display: 'flex', gap: '25px' }}>
          {['TWITTER', 'INSTAGRAM', 'DISCORD'].map((s, i) => (
            <a key={i} href="#" style={{ fontFamily: 'var(--body-font)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.2em', color: '#9ca3af', textDecoration: 'none', transition: 'color 0.3s' }} onMouseOver={(e) => e.target.style.color = '#fff'} onMouseOut={(e) => e.target.style.color = '#9ca3af'}>
              {s}
            </a>
          ))}
        </div>

        {/* Studio Info Center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontFamily: 'var(--body-font)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.2em', color: '#9ca3af', textTransform: 'uppercase' }}>
          <span>BUILT BY</span>
          <div style={{ width: '32px', height: '1px', background: '#374151' }} />
          <span style={{ color: '#ffffff', fontWeight: 700 }}>MEET G. DAVE</span>
        </div>

        {/* Copyright Right */}
        <div style={{ fontFamily: 'var(--body-font)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.2em', color: '#4b5563', textTransform: 'uppercase' }}>
          ©2026 AiRA LAB. ALL RIGHTS RESERVED.
        </div>

      </footer>
    </div>
  );

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
            <button type="submit" className="retro-btn" style={{ flex: 2 }}>JOIN LOBBY</button>
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

  const renderAdminLogin = () => (
    <motion.div 
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="glass-card" style={{ width: '100%', maxWidth: '450px', padding: '60px', textAlign: 'center', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)' }}>
        <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', color: 'var(--hot-pink)', marginBottom: '40px' }}>HOST LOGIN</h1>
        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <input 
            type="password" 
            className="retro-input" 
            placeholder="ENTER PASSWORD" 
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)' }}
            autoFocus
          />
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

  const renderJoinedLobby = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px', maxWidth: '600px', width: '100%', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)' }}>
        {isAdmin ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', marginBottom: '10px', fontSize: '2rem' }}>ADMIN DASHBOARD</h2>
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '15px', padding: '30px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '1.2rem', color: '#ccc', fontFamily: 'var(--modern-font)' }}>Connected Players</p>
              <p className="gradient-text" style={{ fontSize: '6rem', margin: '10px 0', fontFamily: 'var(--retro-font)' }}>{Object.keys(gameState.players).length}</p>
            </div>
            <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', padding: '20px', fontSize: '1.2rem' }}>
              START ARCADE
            </button>
          </div>
        ) : (
          <div>
            <motion.h2 animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', marginBottom: '20px', fontSize: '2rem' }}>
              WAITING FOR HOST...
            </motion.h2>
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '15px', padding: '30px', margin: '40px 0', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '1.2rem', color: '#ccc', fontFamily: 'var(--modern-font)' }}>PLAYERS IN LOBBY</p>
              <p style={{ color: 'var(--cyan)', fontSize: '4rem', fontFamily: 'var(--retro-font)', marginTop: '20px' }}>{Object.keys(gameState.players).length}</p>
            </div>
            <p style={{ color: '#aaa', fontSize: '1.1rem', fontFamily: 'var(--modern-font)' }}>LOGGED IN AS:</p>
            <h3 style={{ color: 'var(--hot-pink)', marginTop: '10px', fontSize: '2rem', fontFamily: 'var(--retro-font)' }}>{nickname}</h3>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderGame = (title) => {
    if (isAdmin) {
      // ADMIN LIVE ANALYTICS VIEW
      return (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}
        >
          <h1 style={{ fontFamily: 'var(--retro-font)', fontSize: '2.5rem', marginBottom: '30px', color: '#fff', textAlign: 'center', textShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>ADMIN ANALYTICS</h1>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', width: '100%', maxWidth: '1200px' }}>
            
            {/* Left Column - Question Info & Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '30px', background: 'rgba(10,10,15,0.9)' }}>
                <h3 style={{ color: 'var(--hot-pink)', fontFamily: 'var(--retro-font)', marginBottom: '15px' }}>TIME LEFT: {timeLeft}s</h3>
                <h2 style={{ fontFamily: 'var(--modern-font)', fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{gameState.currentQuestion ? gameState.currentQuestion.text : 'Waiting...'}</h2>
                
                {gameState.currentQuestion?.image && (
                  <img src={gameState.currentQuestion.image} alt="Meme" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)' }} />
                )}
              </div>

              <div className="glass-card" style={{ padding: '30px', background: 'rgba(10,10,15,0.9)' }}>
                <h3 style={{ color: 'var(--cyan)', fontFamily: 'var(--retro-font)', marginBottom: '20px', fontSize: '1rem' }}>LIVE ANSWERS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {gameState.currentQuestion?.options.map((opt, i) => {
                    const count = liveAnalytics.optionCounts[i] || 0;
                    const total = Object.keys(gameState.players).length || 1;
                    const percent = Math.min(100, Math.round((count / total) * 100));
                    
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '150px', fontFamily: 'var(--modern-font)', fontSize: '1rem', color: '#ccc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{opt}</div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '20px', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', background: 'var(--cyan)', transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ width: '50px', textAlign: 'right', fontFamily: 'var(--retro-font)', fontSize: '0.8rem', color: 'var(--cyan)' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Stats & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '30px', background: 'rgba(10,10,15,0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--modern-font)', color: '#aaa', fontSize: '1.2rem' }}>TOTAL RESPONSES</div>
                <div style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem', color: 'var(--neon-green)' }}>{liveAnalytics.totalAnswers} <span style={{ fontSize: '1rem', color: '#555' }}>/ {Object.keys(gameState.players).length}</span></div>
              </div>

              <div className="glass-card" style={{ padding: '30px', background: 'rgba(10,10,15,0.9)', flex: 1 }}>
                <h3 style={{ color: 'gold', fontFamily: 'var(--retro-font)', marginBottom: '20px', fontSize: '1rem' }}>FASTEST FINGERS</h3>
                {liveAnalytics.fastestFingers.length === 0 ? (
                  <p style={{ color: '#555', fontFamily: 'var(--modern-font)' }}>Waiting for correct answers...</p>
                ) : (
                  liveAnalytics.fastestFingers.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontFamily: 'var(--modern-font)', fontWeight: 700, color: '#fff', fontSize: '1.2rem' }}>{i+1}. {f.nickname}</span>
                      <span style={{ fontFamily: 'var(--retro-font)', color: 'var(--neon-green)', fontSize: '0.9rem' }}>{f.timeTaken}s</span>
                    </div>
                  ))
                )}
              </div>

              <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.8)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => adminAction('NEXT_QUESTION')} className="retro-btn" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)', fontSize: '0.9rem', padding: '10px 15px', width: '100%', marginBottom: '10px' }}>NEXT QUESTION ➔</button>
                <button onClick={() => adminAction('START_GAME1')} className="retro-btn" style={{ fontSize: '0.8rem', padding: '10px 15px' }}>RESTART G1</button>
                <button onClick={() => adminAction('START_GAME2')} className="retro-btn" style={{ fontSize: '0.8rem', padding: '10px 15px' }}>G2: COMEDY</button>
                <button onClick={() => adminAction('START_GAME3')} className="retro-btn" style={{ fontSize: '0.8rem', padding: '10px 15px' }}>G3: MARATHON</button>
                <button onClick={() => adminAction('SHOW_LEADERBOARD')} className="retro-btn" style={{ borderColor: 'var(--hot-pink)', color: 'var(--hot-pink)', fontSize: '0.8rem', padding: '10px 15px' }}>SHOW LEADERBOARD</button>
              </div>
            </div>

          </div>
        </motion.div>
      );
    }

    // PLAYER VIEW
    const myPlayer = gameState.players[socket.id];
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}
      >
        <div className="glass-card" style={{ position: 'absolute', top: 20, right: 20, textAlign: 'right', padding: '10px 20px', background: 'rgba(10,10,15,0.8)' }}>
           <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px', fontFamily: 'var(--modern-font)' }}>PLAYER: <span style={{ color: '#fff' }}>{nickname}</span></p>
           <p style={{ color: 'var(--neon-green)', fontSize: '1.2rem', fontFamily: 'var(--retro-font)' }}>SCORE: {myPlayer ? myPlayer.score : 0}</p>
        </div>
        
        {gameState.currentQuestion ? (
          <div className="glass-card" style={{ textAlign: 'center', maxWidth: '800px', width: '100%', padding: '40px', background: 'rgba(10,10,15,0.85)' }}>
            <h2 style={{ color: 'var(--hot-pink)', marginBottom: '20px', fontSize: '2rem', fontFamily: 'var(--retro-font)' }}>TIME: {timeLeft}</h2>
            
            {gameState.currentQuestion.image && (
              <img src={gameState.currentQuestion.image} alt="Meme Reference" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', marginBottom: '20px', borderRadius: '15px', border: '2px solid rgba(255,255,255,0.1)' }} />
            )}

            <h3 style={{ marginBottom: '40px', lineHeight: '1.6', fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--modern-font)' }}>{gameState.currentQuestion.text}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {gameState.currentQuestion.options.map((opt, i) => {
                let btnStyle = { fontSize: '1.1rem', padding: '20px', fontFamily: 'var(--modern-font)', fontWeight: 700 };
                if (answerResult) {
                  if (answerResult.correctOption === i) {
                    btnStyle.backgroundColor = 'var(--neon-green)';
                    btnStyle.color = '#000';
                    btnStyle.borderColor = 'var(--neon-green)';
                  } else if (selectedOption === i) {
                    btnStyle.backgroundColor = 'rgba(255, 0, 0, 0.5)';
                    btnStyle.color = '#fff';
                    btnStyle.borderColor = 'red';
                  }
                } else if (selectedOption === i) {
                  btnStyle.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  btnStyle.color = '#aaa';
                  btnStyle.borderColor = '#555';
                  btnStyle.boxShadow = 'none';
                }

                return (
                  <button 
                    key={i} 
                    className="retro-btn" 
                    style={btnStyle}
                    onClick={() => submitAnswer(i)}
                    disabled={selectedOption !== null || answerResult !== null}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <motion.h2 animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="gradient-text" style={{ fontFamily: 'var(--retro-font)', fontSize: '2rem' }}>PREPARING QUESTION...</motion.h2>
        )}
      </motion.div>
    );
  };

  const renderLeaderboard = () => (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <h1 className="gradient-text" style={{ fontFamily: 'var(--retro-font)', fontSize: '4rem', marginBottom: '50px', textShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>FINAL STANDINGS</h1>
      <div className="glass-card" style={{ padding: '50px', width: '100%', maxWidth: '800px', background: 'rgba(10,10,15,0.8)' }}>
        {gameState.leaderboard && gameState.leaderboard.map((p, i) => (
          <motion.div 
            key={p.id} 
            initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '1.5rem', color: i === 0 ? 'var(--cyan)' : 'white' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{ fontFamily: 'var(--retro-font)', fontSize: i === 0 ? '2.5rem' : '1.5rem', color: i === 0 ? 'gold' : '#777' }}>
                {i === 0 ? '🏆' : `${i + 1}.`}
              </span>
              <span style={{ fontFamily: 'var(--modern-font)', fontWeight: 700, fontSize: '1.8rem' }}>{p.nickname}</span>
            </div>
            <span style={{ color: 'var(--neon-green)', fontFamily: 'var(--retro-font)', fontSize: '1.8rem' }}>{p.score}</span>
          </motion.div>
        ))}
      </div>
      {isAdmin && (
        <button onClick={() => { setUiView('LANDING'); adminAction('RESET_LOBBY'); }} className="retro-btn" style={{ marginTop: '50px', padding: '20px 40px', fontSize: '1.2rem' }}>BACK TO HOME</button>
      )}
    </motion.div>
  );

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

      {gameState.phase === 'LOBBY' && uiView === 'LANDING' && renderLandingPage()}
      {gameState.phase === 'LOBBY' && uiView === 'ENTER_GAME' && renderEnterGame()}
      {gameState.phase === 'LOBBY' && uiView === 'ADMIN_LOGIN' && renderAdminLogin()}
      {gameState.phase === 'LOBBY' && uiView === 'JOINED' && renderJoinedLobby()}
      
      {['GAME1', 'GAME2', 'GAME3'].includes(gameState.phase) && renderGame('ARENA')}
      
      {gameState.phase === 'LEADERBOARD' && renderLeaderboard()}

      <button onClick={toggleMusic} style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1000, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--cyan)', color: 'var(--cyan)', padding: '10px 20px', borderRadius: '50px', cursor: 'pointer', backdropFilter: 'blur(10px)', fontFamily: 'var(--modern-font)', fontSize: '0.9rem', fontWeight: 700 }}>
        {isMusicPlaying ? '🔊 MUSIC ON' : '🔈 MUSIC OFF'}
      </button>
      <audio ref={audioRef} src="/bg-music.mp3" loop />
    </div>
  );
}

export default App;
