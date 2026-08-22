const { io } = require('socket.io-client');

const socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log('⚡ Admin connected to backend. Triggering START_GAME1...');
  socket.emit('adminAuth', 'admin123', (res) => {
    if (res.success) {
      socket.emit('adminAction', 'START_GAME1');
      console.log('✅ Triggered START_GAME1 for all 150 active players!');
      setTimeout(() => process.exit(0), 1000);
    } else {
      console.error('Failed admin auth');
      process.exit(1);
    }
  });
});
