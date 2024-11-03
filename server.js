const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'create':
        handleCreateRoom(ws, data.roomId);
        break;
      case 'join':
        handleJoinRoom(ws, data.roomId);
        break;
      case 'offer':
      case 'answer':
      case 'candidate':
        forwardMessageToRoom(ws, data.roomId, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleDisconnect(ws);
  });
});

function handleCreateRoom(ws, roomId) {
  if (rooms[roomId]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room already exists' }));
  } else {
    rooms[roomId] = [ws];
    ws.roomId = roomId;
    ws.send(JSON.stringify({ type: 'created', roomId: roomId }));
    console.log(`Room created: ${roomId}`);
  }
}

function handleJoinRoom(ws, roomId) {
  const room = rooms[roomId];
  if (room) {
    room.push(ws);
    ws.roomId = roomId;
    ws.send(JSON.stringify({ type: 'joined', roomId: roomId }));

    // Notify existing participants that a new peer has joined
    room.forEach(client => {
      if (client !== ws) {
        client.send(JSON.stringify({ type: 'peer-joined', roomId: roomId }));
      }
    });

    console.log(`Client joined room: ${roomId}`);
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
  }
}

function forwardMessageToRoom(ws, roomId, message) {
  const room = rooms[roomId];
  if (room) {
    room.forEach(client => {
      if (client !== ws) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

function handleDisconnect(ws) {
  const roomId = ws.roomId;
  if (roomId && rooms[roomId]) {
    rooms[roomId] = rooms[roomId].filter(client => client !== ws);

    // Notify remaining clients in the room about disconnection
    rooms[roomId].forEach(client => {
      client.send(JSON.stringify({ type: 'peer-disconnected', roomId: roomId }));
    });

    if (rooms[roomId].length === 0) {
      delete rooms[roomId];
      console.log(`Room deleted: ${roomId}`);
    }
  }
}

console.log(`WebSocket signaling server is running on ws://localhost:${PORT}`);
