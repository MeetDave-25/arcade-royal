require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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
  `, (err) => {
    release();
    if (err) return console.error('Error creating table', err.stack);
  });
});

let gameState = {
  phase: 'LOBBY', 
  players: {}, 
  currentQuestion: null,
  timeLeft: 0,
  leaderboard: [],
  roomOtp: null
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

const questionsG1 = [
  { id: 1, text: '😂 Q1. This iconic reaction/meme is from which movie?', image: '/meme/Hera-Pheri-Memes-8.jpg', options: ['Hera Pheri', 'Welcome', 'Dhamaal', 'Bhool Bhulaiyaa'], answer: 0 },
  { id: 2, text: '🤣 Q2. Which Bollywood movie is behind this iconic chaotic meme energy?', image: '/meme/2.jpg', options: ['Welcome', 'Golmaal', 'Phir Hera Pheri', 'Bhool Bhulaiyaa'], answer: 0 },
  { id: 3, text: '🎓 Q3. "Engineering + friendship + absolute chaos" — identify the movie.', options: ['3 Idiots', 'Chhichhore', 'Student of the Year', 'Munna Bhai M.B.B.S.'], answer: 0 },
  { id: 4, text: '👻 Q4. A funny horror-comedy scene featuring Akshay Kumar — which movie?', options: ['Stree', 'Bhool Bhulaiyaa', 'Bhoot Police', 'Roohi'], answer: 1 },
  { id: 5, text: '🎵 Q5. ❤️ + 🫵 + 🌎 Which song?', options: ['Tum Hi Ho', 'Apna Bana Le', 'Kesariya', 'Raataan Lambiyan'], answer: 1 },
  { id: 6, text: '🎵 Q6. 🌧️ + ❤️🩹 + 🚶‍♂️ + 💔 Which song fits?', options: ['Agar Tum Saath Ho', 'Channa Mereya', 'Tujhe Kitna Chahne Lage', 'Hamari Adhuri Kahani'], answer: 1 },
  { id: 7, text: '🎵 Q7. 🌅 + 👩‍❤️‍👨 + 🏠 Guess the song.', options: ['Apna Bana Le', 'Ranjha', 'Ve Kamleya', 'Hawayein'], answer: 1 },
  { id: 8, text: '🎵 Q8. 💃 + 🕺 + 🥳 + ❤️ Which song?', options: ['What Jhumka?', 'Gallan Goodiyaan', 'Nacho Nacho', 'Aankh Marey'], answer: 1 },
  { id: 9, text: '🎵 Q9. 🛣️ + 🚗 + 👬 + 🌍 Which song/movie vibe is this?', options: ['Ilahi', 'Safarnama', 'Yun Hi Chala Chal', 'Khaabon Ke Parinday'], answer: 1 },
  { id: 10, text: '😂 Q10. When your friend says "Bro, trust me" and you immediately know you\'re finished. Which movie gives this meme energy?', options: ['Hera Pheri', 'Andaz Apna Apna', 'Golmaal', 'Munna Bhai M.B.B.S.'], answer: 0 },
  { id: 11, text: '😂 Q11. 💀 When the plan was perfect… until your friend joined. Which movie?', options: ['Dhamaal', 'Welcome', 'Golmaal', 'Housefull'], answer: 0 },
  { id: 12, text: '😂 Q12. 🧠 When you studied everything except what came in the exam. Which movie?', options: ['3 Idiots', 'Chhichhore', 'Munna Bhai M.B.B.S.', 'Taare Zameen Par'], answer: 0 },
  { id: 13, text: '😂 Q13. 💸 "Broke but still planning a luxury life." Which movie?', options: ['Phir Hera Pheri', 'Welcome', 'Dhamaal', 'Fukrey'], answer: 0 },
  { id: 14, text: '🔥 Q14. 👨‍🎓👨‍🎓👨‍🎓 + 🎓 + 🤪 + ❤️ Which movie?', options: ['3 Idiots', 'Chhichhore', 'Student of the Year', 'Rang De Basanti'], answer: 0 },
  { id: 15, text: '🔥 Q15. 👻 + 🏚️ + 😂 + 💃 Which movie?', options: ['Stree', 'Bhool Bhulaiyaa', 'Roohi', 'Bhoot Police'], answer: 0 },
  { id: 16, text: '🔥 Q16. 👮 + ❤️ + 😂 + 🏃 Which movie?', options: ['Singham', 'Dabangg', 'Chennai Express', 'Wanted'], answer: 1 },
  { id: 17, text: '⚡ Q17. HARD MODE: 🎵 💔 ☕ 🌧️ 👫❌ Guess the song.', options: ['Channa Mereya', 'Agar Tum Saath Ho', 'Hamari Adhuri Kahani', 'Phir Bhi Tumko Chaahunga'], answer: 1 },
  { id: 18, text: '⚡ Q18. 🏃‍♂️🏃‍♂️🏃‍♂️ + 💰 + 🤯 + 🏝️ Which movie?', options: ['Dhamaal', 'Dhol', 'All the Best', 'De Dana Dan'], answer: 0 },
  { id: 19, text: '⚡ Q19. 👨‍👩‍👧‍👦 + 💍 + 💃 + 🥳 + 🎶 Guess the movie.', options: ['Hum Aapke Hain Koun', 'Kabhi Khushi Kabhie Gham', '2 States', 'Rocky Aur Rani Kii Prem Kahaani'], answer: 0 },
  { id: 20, text: '⚡ Q20. 🧑‍🤝‍🧑 + 🛣️ + 🍺❌ + 🗺️ + ✈️ Which movie?', options: ['Zindagi Na Milegi Dobara', 'Dil Chahta Hai', 'Yeh Jawaani Hai Deewani', 'Tamasha'], answer: 0 }
];

const questionsG2 = [
  { id: 21, text: 'WHAT HAPPENS NEXT? (Imagine a guy holding a diet coke and mentos...)', options: ['He drinks it', 'It explodes', 'He gives it to a dog', 'Nothing'], answer: 1 }
];

const questionsG3 = [
  { id: 22, text: 'MARATHON: Which of these is a classic 8-bit game?', options: ['Halo', 'Pac-Man', 'Fortnite', 'Minecraft'], answer: 1 }
];

function broadcastAnalytics() {
  io.emit('liveAnalytics', currentAnalytics);
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

function sendQuestion(q) {
  if (!q) return;
  gameState.currentQuestion = { id: q.id, text: q.text, options: q.options, image: q.image };
  
  currentAnalytics = {
    totalAnswers: 0,
    optionCounts: [0, 0, 0, 0],
    fastestFingers: []
  };
  broadcastAnalytics();

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

  socket.on('joinGame', (nickname) => {
    if (!gameState.roomOtp) {
      gameState.roomOtp = generateOtp();
    }
    if (gameState.phase === 'LOBBY') {
      gameState.phase = 'VERIFICATION';
    }
    gameState.players[socket.id] = { id: socket.id, nickname, score: 0, answered: false, verified: false };
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
    
    let currentQList = questionsG1;
    if (gameState.phase === 'GAME2') currentQList = questionsG2;
    if (gameState.phase === 'GAME3') currentQList = questionsG3;
    
    const q = currentQList.find(x => x.id === gameState.currentQuestion.id);
    if (q) {
      currentAnalytics.totalAnswers++;
      currentAnalytics.optionCounts[optionIndex]++;
      
      const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(2);

      if (q.answer === optionIndex) {
        player.score += (gameState.timeLeft * 10);
        
        currentAnalytics.fastestFingers.push({ nickname: player.nickname, timeTaken });
        currentAnalytics.fastestFingers.sort((a, b) => a.timeTaken - b.timeTaken);
        if (currentAnalytics.fastestFingers.length > 5) {
          currentAnalytics.fastestFingers.pop();
        }
      }
      
      io.emit('gameStateUpdate', gameState);
      broadcastAnalytics();
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
      currentQuestionIndex = 0;
      currentAnalytics = { totalAnswers: 0, optionCounts: [0, 0, 0, 0], fastestFingers: [] };
      Object.values(gameState.players).forEach(p => {
        p.score = 0;
        p.answered = false;
        p.verified = false;
      });
      io.emit('gameStateUpdate', gameState);
      broadcastAnalytics();
    } else if (action === 'START_GAME1') {
      clearInterval(timerInterval);
      gameState.phase = 'GAME1';
      currentQuestionIndex = 0;
      Object.values(gameState.players).forEach(p => { p.answered = false; });
      io.emit('gameStateUpdate', gameState);
      sendQuestion(questionsG1[currentQuestionIndex]);
    } else if (action === 'NEXT_QUESTION') {
      let currentQList = questionsG1;
      if (gameState.phase === 'GAME2') currentQList = questionsG2;
      if (gameState.phase === 'GAME3') currentQList = questionsG3;
      
      currentQuestionIndex++;
      if (currentQuestionIndex < currentQList.length) {
        sendQuestion(currentQList[currentQuestionIndex]);
      } else {
        clearInterval(timerInterval);
        gameState.phase = 'LEADERBOARD';
        gameState.leaderboard = Object.values(gameState.players).sort((a, b) => b.score - a.score);
        io.emit('gameStateUpdate', gameState);
      }
    } else if (action === 'START_GAME2') {
      clearInterval(timerInterval);
      gameState.phase = 'GAME2';
      currentQuestionIndex = 0;
      Object.values(gameState.players).forEach(p => { p.answered = false; });
      io.emit('gameStateUpdate', gameState);
      sendQuestion(questionsG2[currentQuestionIndex]);
    } else if (action === 'START_GAME3') {
      clearInterval(timerInterval);
      gameState.phase = 'GAME3';
      currentQuestionIndex = 0;
      Object.values(gameState.players).forEach(p => { p.answered = false; });
      io.emit('gameStateUpdate', gameState);
      sendQuestion(questionsG3[currentQuestionIndex]);
    } else if (action === 'SHOW_LEADERBOARD') {
      clearInterval(timerInterval);
      gameState.phase = 'LEADERBOARD';
      gameState.leaderboard = Object.values(gameState.players).sort((a, b) => b.score - a.score);
      
      gameState.leaderboard.forEach(p => {
        pool.query('INSERT INTO players (nickname, score) VALUES ($1, $2)', [p.nickname, p.score]).catch(console.error);
      });
      
      io.emit('gameStateUpdate', gameState);
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      delete gameState.players[socket.id];
      io.emit('gameStateUpdate', gameState);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
