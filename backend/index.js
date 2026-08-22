require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploads folder statically if present
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Health Check for Render / Uptime Monitoring
app.get('/', (req, res) => {
  res.status(200).send('🎮 Arcade Royale Backend is Running!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), playersCount: Object.keys(gameState.players).length, timestamp: new Date() });
});

// API endpoint to upload image/video for questions
app.post('/api/upload', (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    if (!fileData) return res.status(400).json({ error: 'No file data provided' });

    const base64Data = fileData.replace(/^data:(image|video)\/\w+;base64,/, '');
    const safeName = `${Date.now()}_${(fileName || 'media').replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, base64Data, 'base64');
    const mediaUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: mediaUrl });
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB payload limit
  transports: ['websocket', 'polling']
});

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : false
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let questionsG1 = [
  { id: 1, text: '😂 Q1. This iconic reaction/meme is from which movie?', image: '/meme/Hera-Pheri-Memes-8.jpg', options: ['Hera Pheri', 'Welcome', 'Dhamaal', 'Bhool Bhulaiyaa'], answer: 0 },
  { id: 2, text: '🤣 Q2. Which Bollywood movie is behind this iconic chaotic meme energy?', image: '/meme/2.jpg', options: ['Welcome', 'Golmaal', 'Phir Hera Pheri', 'Bhool Bhulaiyaa'], answer: 0 },
  { id: 3, text: '🐱 Q3. What is the cat doing?', image: '/meme/3.mp4', options: ['Trying to hack NASA 🧑💻', 'Doing homework 📚', 'Fighting with the laptop 💻', 'Scooba dance 💃'], answer: 3 },
  { id: 4, text: '😂 Q4. 💀 When the plan was perfect… until your friend joined. Which movie?', options: ['Dhamaal', 'Welcome', 'Golmaal', 'Housefull'], answer: 0 },
  { id: 5, text: '😂 Q5. 🧠 When you studied everything except what came in the exam. Which movie?', options: ['3 Idiots', 'Chhichhore', 'Munna Bhai M.B.B.S.', 'Taare Zameen Par'], answer: 0 },
  { id: 6, text: '😂 Q6. 💸 "Broke but still planning a luxury life." Which movie?', options: ['Phir Hera Pheri', 'Welcome', 'Dhamaal', 'Fukrey'], answer: 0 },
  { id: 7, text: '👻 Q7. A funny horror-comedy scene featuring Akshay Kumar — which movie?', options: ['Stree', 'Bhool Bhulaiyaa', 'Bhoot Police', 'Roohi'], answer: 1 },
  { id: 8, text: '🎓 Q8. "Engineering + friendship + absolute chaos" — identify the movie.', options: ['3 Idiots', 'Chhichhore', 'Student of the Year', 'Munna Bhai M.B.B.S.'], answer: 0 },
  { id: 9, text: '🔥 Q9. 👻 + 🏚️ + 😂 + 💃 Which horror comedy meme movie?', options: ['Stree', 'Bhool Bhulaiyaa', 'Roohi', 'Bhoot Police'], answer: 1 },
  { id: 10, text: '🏃 Q10. 🏃‍♂️🏃‍♂️🏃‍♂️ + 💰 + 🤯 + 🏝️ 4 friends chasing money — Which movie?', options: ['Dhamaal', 'Dhol', 'All the Best', 'De Dana Dan'], answer: 0 }
];

let questionsG2 = [
  { id: 11, text: '🎵 Q1. ❤️ + 🫵 + 🌎 Guess the song name!', options: ['Tum Hi Ho', 'Apna Bana Le', 'Kesariya', 'Raataan Lambiyan'], answer: 1 },
  { id: 12, text: '🎵 Q2. 🌧️ + ❤️🩹 + 🚶‍♂️ + 💔 Guess the song name!', options: ['Agar Tum Saath Ho', 'Channa Mereya', 'Tujhe Kitna Chahne Lage', 'Hamari Adhuri Kahani'], answer: 1 },
  { id: 13, text: '🎵 Q3. 🌅 + 👩‍❤️‍👨 + 🏠 Guess the song name!', options: ['Apna Bana Le', 'Ranjha', 'Ve Kamleya', 'Hawayein'], answer: 0 },
  { id: 14, text: '🎵 Q4. 💃 + 🕺 + 🥳 + ❤️ Guess the song name!', options: ['What Jhumka?', 'Gallan Goodiyaan', 'Nacho Nacho', 'Aankh Marey'], answer: 1 },
  { id: 15, text: '🎵 Q5. 🛣️ + 🚗 + 👬 + 🌍 Guess the song name!', options: ['Ilahi', 'Safarnama', 'Yun Hi Chala Chal', 'Khaabon Ke Parinday'], answer: 1 },
  { id: 16, text: '⚡ Q6. 🎵 💔 ☕ 🌧️ 👫❌ Guess the song name!', options: ['Channa Mereya', 'Agar Tum Saath Ho', 'Hamari Adhuri Kahani', 'Phir Bhi Tumko Chaahunga'], answer: 1 },
  { id: 17, text: '🎬 Q7. 👨‍🎓👨‍🎓👨‍🎓 + 🎓 + 🤪 + ❤️ Guess the movie name!', options: ['3 Idiots', 'Chhichhore', 'Student of the Year', 'Rang De Basanti'], answer: 0 },
  { id: 18, text: '🎬 Q8. 👮 + ❤️ + 😂 + 🏃 Guess the movie name!', options: ['Singham', 'Dabangg', 'Chennai Express', 'Wanted'], answer: 1 },
  { id: 19, text: '🎬 Q9. 👨‍👩‍👧‍👦 + 💍 + 💃 + 🥳 + 🎶 Guess the movie name!', options: ['Hum Aapke Hain Koun', 'Kabhi Khushi Kabhie Gham', '2 States', 'Rocky Aur Rani Kii Prem Kahaani'], answer: 0 },
  { id: 20, text: '🎬 Q10. 🧑‍🤝‍🧑 + 🛣️ + 🍺❌ + 🗺️ + ✈️ Guess the movie name!', options: ['Zindagi Na Milegi Dobara', 'Dil Chahta Hai', 'Yeh Jawaani Hai Deewani', 'Tamasha'], answer: 0 }
];

async function loadQuestionsFromDB() {
  try {
    const res = await pool.query('SELECT * FROM questions ORDER BY sort_order ASC, id ASC');
    if (res.rows.length > 0) {
      const g1 = [];
      const g2 = [];
      res.rows.forEach(r => {
        const qObj = {
          id: r.id,
          text: r.text,
          image: r.image,
          options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
          answer: r.answer
        };
        if (r.game_id === 'GAME2') {
          g2.push(qObj);
        } else {
          g1.push(qObj);
        }
      });
      if (g1.length > 0) questionsG1 = g1;
      if (g2.length > 0) questionsG2 = g2;
      console.log(`Loaded ${questionsG1.length} Game 1 Qs and ${questionsG2.length} Game 2 Qs from Database!`);
    } else {
      console.log('Seeding default questions into Database...');
      let order = 1;
      for (const q of questionsG1) {
        await pool.query('INSERT INTO questions (game_id, text, image, options, answer, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
          ['GAME1', q.text, q.image || null, JSON.stringify(q.options), q.answer, order++]);
      }
      for (const q of questionsG2) {
        await pool.query('INSERT INTO questions (game_id, text, image, options, answer, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
          ['GAME2', q.text, q.image || null, JSON.stringify(q.options), q.answer, order++]);
      }
      console.log('Default questions seeded successfully!');
    }
  } catch (err) {
    console.error('Error loading/seeding questions from DB:', err.message);
  }
}

pool.connect((err, client, release) => {
  if (err) return console.error('Error acquiring client', err.stack);
  console.log('Connected to Neon Database successfully!');
  client.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      nickname VARCHAR(255) NOT NULL,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      game_id VARCHAR(50) NOT NULL,
      text TEXT NOT NULL,
      image TEXT,
      options JSONB NOT NULL,
      answer INTEGER NOT NULL,
      sort_order INT DEFAULT 0
    );
  `, async (err) => {
    release();
    if (err) return console.error('Error creating tables', err.stack);
    await loadQuestionsFromDB();
  });
});

let gameState = {
  phase: 'LOBBY', 
  players: {}, 
  currentQuestion: null,
  timeLeft: 0,
  leaderboard: [],
  roomOtp: null,
  currentQuestionIndex: 0,
  totalQuestions: 0,
};

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

let currentAnalytics = {
  totalAnswers: 0,
  optionCounts: [0, 0, 0, 0],
  fastestFingers: [] 
};

let timerInterval;
let questionStartTime = 0;
let currentQuestionIndex = 0;
let analyticsBroadcastTimeout = null;

// HIGH CONCURRENCY DB FIX: Single multi-row batch insert instead of N individual queries
async function saveLeaderboardToDB() {
  const leaderboard = Object.values(gameState.players)
    .filter(p => p && p.nickname)
    .sort((a, b) => b.score - a.score);

  if (leaderboard.length === 0) return;

  const values = [];
  const valueStrings = leaderboard.map((p, idx) => {
    values.push(p.nickname, p.score);
    return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
  });

  const queryText = `INSERT INTO players (nickname, score) VALUES ${valueStrings.join(', ')}`;
  try {
    await pool.query(queryText, values);
    console.log(`⚡ Batch saved ${leaderboard.length} players to database successfully in 1 query!`);
  } catch (err) {
    console.error('Error batch saving leaderboard to DB:', err);
  }
}

function broadcastAnalyticsThrottled() {
  if (!analyticsBroadcastTimeout) {
    analyticsBroadcastTimeout = setTimeout(() => {
      io.emit('liveAnalytics', currentAnalytics);
      analyticsBroadcastTimeout = null;
    }, 250);
  }
}

function startTimer(seconds, onFinish) {
  clearInterval(timerInterval);
  gameState.timeLeft = seconds;
  io.emit('timer', gameState.timeLeft);
  timerInterval = setInterval(() => {
    gameState.timeLeft--;
    io.emit('timer', gameState.timeLeft);
    if (gameState.timeLeft <= 0) {
      clearInterval(timerInterval);
      onFinish();
    }
  }, 1000);
}

function getQuestionList() {
  if (gameState.phase === 'GAME2') return questionsG2;
  return questionsG1;
}

function sendQuestion(q) {
  if (!q) return;
  gameState.currentQuestion = { id: q.id, text: q.text, options: q.options, image: q.image };
  gameState.currentQuestionIndex = currentQuestionIndex;
  gameState.totalQuestions = getQuestionList().length;
  
  currentAnalytics = {
    totalAnswers: 0,
    optionCounts: [0, 0, 0, 0],
    fastestFingers: [],
    correctOption: q.answer
  };
  io.emit('liveAnalytics', currentAnalytics);
  io.emit('question', gameState.currentQuestion);
  
  Object.values(gameState.players).forEach(p => p.answered = false);
  questionStartTime = Date.now();
  
  startTimer(15, () => {
    io.emit('answerResult', { correctOption: q.answer });
  });
}

io.on('connection', (socket) => {
  socket.emit('gameStateUpdate', gameState);
  socket.emit('liveAnalytics', currentAnalytics);

  // Admin authentication via socket
  socket.on('adminAuth', (password, callback) => {
    if (password === ADMIN_PASSWORD) {
      callback({ success: true });
    } else {
      callback({ success: false, error: 'Incorrect password!' });
    }
  });

  // Admin Question Management socket handlers
  socket.on('adminGetQuestions', (callback) => {
    if (typeof callback === 'function') {
      callback({ success: true, questionsG1, questionsG2 });
    }
  });

  socket.on('adminSaveQuestion', async (payload, callback) => {
    try {
      const { gameId, question } = payload; // gameId = 'GAME1' or 'GAME2'
      if (!question || !question.text || !question.options) {
        if (typeof callback === 'function') callback({ success: false, error: 'Invalid question data' });
        return;
      }

      if (question.id && typeof question.id === 'number') {
        // Update existing question
        await pool.query(
          'UPDATE questions SET text=$1, image=$2, options=$3, answer=$4 WHERE id=$5',
          [question.text, question.image || null, JSON.stringify(question.options), parseInt(question.answer) || 0, question.id]
        );
      } else {
        // Insert new question
        await pool.query(
          'INSERT INTO questions (game_id, text, image, options, answer) VALUES ($1, $2, $3, $4, $5)',
          [gameId || 'GAME1', question.text, question.image || null, JSON.stringify(question.options), parseInt(question.answer) || 0]
        );
      }

      await loadQuestionsFromDB();
      io.emit('questionsUpdated', { questionsG1, questionsG2 });
      if (typeof callback === 'function') callback({ success: true, questionsG1, questionsG2 });
    } catch (err) {
      console.error('Error saving question:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('adminDeleteQuestion', async (questionId, callback) => {
    try {
      await pool.query('DELETE FROM questions WHERE id=$1', [questionId]);
      await loadQuestionsFromDB();
      io.emit('questionsUpdated', { questionsG1, questionsG2 });
      if (typeof callback === 'function') callback({ success: true, questionsG1, questionsG2 });
    } catch (err) {
      console.error('Error deleting question:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  socket.on('joinGame', (nickname) => {
    const cleanNick = (nickname || '').trim();
    if (!cleanNick) return;

    if (!gameState.roomOtp) {
      gameState.roomOtp = generateOtp();
    }
    if (gameState.phase === 'LOBBY') {
      gameState.phase = 'VERIFICATION';
    }

    let existingPlayer = Object.values(gameState.players).find(p => p.nickname.toLowerCase() === cleanNick.toLowerCase());

    if (existingPlayer) {
      delete gameState.players[existingPlayer.id];
      existingPlayer.id = socket.id;
      existingPlayer.online = true;
      gameState.players[socket.id] = existingPlayer;
    } else {
      gameState.players[socket.id] = { id: socket.id, nickname: cleanNick, score: 0, answered: false, verified: false, online: true };
    }

    io.emit('gameStateUpdate', gameState);
  });

  socket.on('verifyOtp', (otpInput) => {
    if (!gameState.players[socket.id]) return;
    if (otpInput && otpInput.toString().trim() === gameState.roomOtp) {
      gameState.players[socket.id].verified = true;
      socket.emit('otpResult', { success: true });
      io.emit('gameStateUpdate', gameState);
    } else {
      socket.emit('otpResult', { success: false, error: 'Incorrect OTP! Check host screen.' });
    }
  });

  socket.on('verifyPresence', () => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].verified = true;
      io.emit('gameStateUpdate', gameState);
    }
  });

  socket.on('submitAnswer', (optionIndex) => {
    const player = gameState.players[socket.id];
    if (!player || player.answered || !gameState.currentQuestion) return;
    
    player.answered = true;
    
    const currentQList = getQuestionList();
    const q = currentQList.find(x => x.id === gameState.currentQuestion.id);
    if (q) {
      currentAnalytics.totalAnswers++;
      if (currentAnalytics.optionCounts[optionIndex] !== undefined) {
        currentAnalytics.optionCounts[optionIndex]++;
      }
      
      const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(2);

      if (q.answer === optionIndex) {
        player.score += (gameState.timeLeft * 10);
        
        currentAnalytics.fastestFingers.push({ nickname: player.nickname, timeTaken });
        currentAnalytics.fastestFingers.sort((a, b) => a.timeTaken - b.timeTaken);
        if (currentAnalytics.fastestFingers.length > 5) {
          currentAnalytics.fastestFingers.pop();
        }
      }
      
      socket.emit('answerAck', { success: true, score: player.score });
      broadcastAnalyticsThrottled();
    }
  });

  socket.on('adminAction', (action, payload) => {
    if (action === 'START_VERIFICATION' || action === 'GENERATE_NEW_OTP') {
      clearInterval(timerInterval);
      gameState.phase = 'VERIFICATION';
      gameState.roomOtp = generateOtp();
      gameState.currentQuestion = null;
      if (action === 'START_VERIFICATION') {
        Object.values(gameState.players).forEach(p => { p.verified = false; });
      }
      io.emit('gameStateUpdate', gameState);
    } else if (action === 'KICK_UNVERIFIED') {
      Object.keys(gameState.players).forEach(id => {
        if (!gameState.players[id].verified) {
          delete gameState.players[id];
        }
      });
      io.emit('gameStateUpdate', gameState);
    } else if (action === 'STOP_GAME' || action === 'RESET_LOBBY') {
      clearInterval(timerInterval);
      gameState.phase = 'LOBBY';
      gameState.currentQuestion = null;
      gameState.timeLeft = 0;
      gameState.roomOtp = null;
      gameState.currentQuestionIndex = 0;
      gameState.totalQuestions = 0;
      currentQuestionIndex = 0;
      currentAnalytics = { totalAnswers: 0, optionCounts: [0, 0, 0, 0], fastestFingers: [] };
      Object.values(gameState.players).forEach(p => {
        p.score = 0;
        p.answered = false;
        p.verified = false;
      });
      io.emit('gameStateUpdate', gameState);
      io.emit('liveAnalytics', currentAnalytics);
    } else if (action === 'START_GAME1') {
      clearInterval(timerInterval);
      gameState.phase = 'GAME1';
      currentQuestionIndex = 0;
      gameState.totalQuestions = questionsG1.length;
      Object.values(gameState.players).forEach(p => { p.answered = false; });
      io.emit('gameStateUpdate', gameState);
      sendQuestion(questionsG1[currentQuestionIndex]);
    } else if (action === 'NEXT_QUESTION') {
      const currentQList = getQuestionList();
      
      currentQuestionIndex++;
      if (currentQuestionIndex < currentQList.length) {
        sendQuestion(currentQList[currentQuestionIndex]);
      } else {
        clearInterval(timerInterval);
        gameState.phase = 'LEADERBOARD';
        gameState.currentQuestion = null;
        gameState.leaderboard = Object.values(gameState.players).sort((a, b) => b.score - a.score);
        saveLeaderboardToDB();
        io.emit('gameStateUpdate', gameState);
      }
    } else if (action === 'START_GAME2') {
      clearInterval(timerInterval);
      gameState.phase = 'GAME2';
      currentQuestionIndex = 0;
      gameState.totalQuestions = questionsG2.length;
      Object.values(gameState.players).forEach(p => { p.answered = false; });
      io.emit('gameStateUpdate', gameState);
      sendQuestion(questionsG2[currentQuestionIndex]);
    } else if (action === 'SHOW_LEADERBOARD') {
      clearInterval(timerInterval);
      gameState.phase = 'LEADERBOARD';
      gameState.currentQuestion = null;
      gameState.leaderboard = Object.values(gameState.players).sort((a, b) => b.score - a.score);
      saveLeaderboardToDB();
      io.emit('gameStateUpdate', gameState);
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].online = false;
      setTimeout(() => {
        if (gameState.players[socket.id] && !gameState.players[socket.id].online) {
          delete gameState.players[socket.id];
          io.emit('gameStateUpdate', gameState);
        }
      }, 30000);
      io.emit('gameStateUpdate', gameState);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
