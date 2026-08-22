const { io } = require('socket.io-client');

const BACKEND_URL = process.argv[2] || 'http://localhost:3001';
const PLAYER_COUNT = parseInt(process.argv[3]) || 150;

console.log(`🚀 Starting Stress Test against ${BACKEND_URL} with ${PLAYER_COUNT} concurrent players...`);

const sockets = [];
let joinedCount = 0;
let verifiedCount = 0;
let roomOtp = null;
let answersSubmitted = 0;

for (let i = 1; i <= PLAYER_COUNT; i++) {
  const socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    forceNew: true
  });

  socket.on('connect', () => {
    const nickname = `Student_${i}`;
    socket.emit('joinGame', nickname);
  });

  socket.on('gameStateUpdate', (state) => {
    if (state.roomOtp && !roomOtp) {
      roomOtp = state.roomOtp;
    }

    if (state.phase === 'VERIFICATION' && roomOtp && !socket.isVerified) {
      socket.isVerified = true;
      socket.emit('verifyOtp', roomOtp);
    }
  });

  socket.on('otpResult', (res) => {
    if (res.success) {
      verifiedCount++;
      if (verifiedCount % 25 === 0 || verifiedCount === PLAYER_COUNT) {
        console.log(`✅ ${verifiedCount}/${PLAYER_COUNT} players verified via OTP!`);
      }
    }
  });

  socket.on('question', (q) => {
    // Random answer choice (0..3) with random latency simulating real student reaction times (200ms - 2500ms)
    const randomOption = Math.floor(Math.random() * 4);
    const delay = Math.floor(Math.random() * 2300) + 200;

    setTimeout(() => {
      socket.emit('submitAnswer', randomOption);
    }, delay);
  });

  socket.on('answerAck', (res) => {
    if (res.success) {
      answersSubmitted++;
    }
  });

  sockets.push(socket);
}

// Monitor progress and output stats
setInterval(() => {
  console.log(`📊 STATS: Connected Sockets: ${sockets.length} | Verified: ${verifiedCount}/${PLAYER_COUNT} | Answers Submitted Total: ${answersSubmitted}`);
}, 5000);
