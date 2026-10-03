import { io as Client } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 500;
const PLAYER_SIZE = 26;
const PLAYER_SPEED = 5;

const players = new Map();

io.on('connection', (socket) => {
  const playerId = socket.id;
  const playerData = {
    id: playerId,
    x: 100,
    y: 100,
    color: '#00d2ff',
    connectedAt: new Date().toISOString()
  };

  players.set(playerId, playerData);

  socket.emit('init', {
    id: playerId,
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, playerSize: PLAYER_SIZE },
    players: Array.from(players.values())
  });

  socket.broadcast.emit('player_joined', {
    ...playerData,
    totalPlayers: players.size
  });

  socket.on('player_move', (input) => {
    const player = players.get(playerId);
    if (!player) return;

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= PLAYER_SPEED;
    if (input.right) dx += PLAYER_SPEED;
    if (input.up) dy -= PLAYER_SPEED;
    if (input.down) dy += PLAYER_SPEED;

    if (dx !== 0 || dy !== 0) {
      player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, player.x + dx));
      player.y = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, player.y + dy));

      io.emit('player_moved', {
        id: playerId,
        x: player.x,
        y: player.y
      });
    }
  });

  socket.on('disconnect', () => {
    players.delete(playerId);
    io.emit('player_left', {
      id: playerId,
      totalPlayers: players.size
    });
  });
});

const TEST_PORT = 4568;
server.listen(TEST_PORT, async () => {
  console.log(`[TEST] Servidor de teste ouvindo na porta ${TEST_PORT}`);

  try {
    let client1JoinedNotice = false;
    let client1LeftNotice = false;
    let client1MovedNotice = false;

    // Cliente 1 conecta
    const client1 = Client(`http://localhost:${TEST_PORT}`);
    
    await new Promise((resolve) => {
      client1.on('connect', () => {
        console.log(`[TEST] Cliente 1 conectado: Conectado como [${client1.id}]`);
        resolve();
      });
    });

    client1.on('player_joined', (data) => {
      console.log(`[TEST] Cliente 1 recebeu aviso de entrada: jogador [${data.id}] em (${data.x}, ${data.y})`);
      client1JoinedNotice = true;
    });

    client1.on('player_moved', (data) => {
      console.log(`[TEST] Cliente 1 recebeu broadcast de movimento: jogador [${data.id}] nova pos (${data.x}, ${data.y})`);
      client1MovedNotice = true;
    });

    client1.on('player_left', (data) => {
      console.log(`[TEST] Cliente 1 recebeu aviso de saída: jogador [${data.id}]`);
      client1LeftNotice = true;
    });

    // Cliente 2 conecta
    const client2 = Client(`http://localhost:${TEST_PORT}`);
    await new Promise((resolve) => {
      client2.on('connect', () => {
        console.log(`[TEST] Cliente 2 conectado: Conectado como [${client2.id}]`);
        resolve();
      });
    });

    // Aguarda propagação do player_joined
    await new Promise((r) => setTimeout(r, 200));
    if (!client1JoinedNotice) throw new Error('Cliente 1 não recebeu player_joined!');

    // Cliente 2 se move
    client2.emit('player_move', { right: true, down: true });

    // Aguarda propagação do player_moved
    await new Promise((r) => setTimeout(r, 200));
    if (!client1MovedNotice) throw new Error('Cliente 1 não recebeu player_moved!');

    // Cliente 2 desconecta
    client2.disconnect();

    // Aguarda propagação do player_left
    await new Promise((r) => setTimeout(r, 200));
    if (!client1LeftNotice) throw new Error('Cliente 1 não recebeu player_left!');

    client1.disconnect();
    console.log('[TEST] TODOS OS TESTES DE MOVIMENTO E SINCRONIZAÇÃO PASSARAM! ✅');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('[TEST] Falha nos testes:', err);
    server.close(() => process.exit(1));
  }
});
