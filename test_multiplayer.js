import { io as Client } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o map.json
const mapData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'map.json'), 'utf-8'));
const collisionLayerData = mapData.layers.find(l => l.name === 'Colisao').data;
const MAP_WIDTH = mapData.width;
const MAP_HEIGHT = mapData.height;
const TILE_SIZE = mapData.tilewidth;
const WORLD_WIDTH = MAP_WIDTH * TILE_SIZE;
const WORLD_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const PLAYER_SPEED = 5;
const HITBOX_HALF_SIZE = 10;

function checkCollision(x, y) {
  const corners = [
    { x: x - HITBOX_HALF_SIZE, y: y - HITBOX_HALF_SIZE },
    { x: x + HITBOX_HALF_SIZE - 1, y: y - HITBOX_HALF_SIZE },
    { x: x - HITBOX_HALF_SIZE, y: y + HITBOX_HALF_SIZE - 1 },
    { x: x + HITBOX_HALF_SIZE - 1, y: y + HITBOX_HALF_SIZE - 1 }
  ];

  for (const pt of corners) {
    if (pt.x < 0 || pt.x >= WORLD_WIDTH || pt.y < 0 || pt.y >= WORLD_HEIGHT) {
      return true;
    }
    const tileX = Math.floor(pt.x / TILE_SIZE);
    const tileY = Math.floor(pt.y / TILE_SIZE);
    const index = tileY * MAP_WIDTH + tileX;
    if (collisionLayerData[index] > 0) {
      return true;
    }
  }
  return false;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = new Map();

io.on('connection', (socket) => {
  const playerId = socket.id;
  const playerData = {
    id: playerId,
    x: 48,
    y: 50,
    direction: 'down',
    isMoving: false
  };

  players.set(playerId, playerData);

  socket.emit('init', {
    id: playerId,
    players: Array.from(players.values())
  });

  socket.on('player_move', (input) => {
    const player = players.get(playerId);
    if (!player) return;

    let dx = 0;
    let dy = 0;
    if (input.left) { dx -= PLAYER_SPEED; player.direction = 'left'; }
    if (input.right) { dx += PLAYER_SPEED; player.direction = 'right'; }
    if (input.up) { dy -= PLAYER_SPEED; player.direction = 'up'; }
    if (input.down) { dy += PLAYER_SPEED; player.direction = 'down'; }

    if (input.direction) player.direction = input.direction;
    player.isMoving = dx !== 0 || dy !== 0 || !!input.isMoving;

    // Colisão autoritativa no servidor
    if (dx !== 0) {
      const nextX = player.x + dx;
      if (!checkCollision(nextX, player.y)) {
        player.x = nextX;
      }
    }

    if (dy !== 0) {
      const nextY = player.y + dy;
      if (!checkCollision(player.x, nextY)) {
        player.y = nextY;
      }
    }

    io.emit('player_moved', {
      id: playerId,
      x: player.x,
      y: player.y,
      direction: player.direction,
      isMoving: player.isMoving
    });
  });

  // Handler de chat_message
  socket.on('chat_message', (msg) => {
    const rawText = typeof msg === 'string' ? msg : (msg && msg.message ? msg.message : '');
    const cleanText = String(rawText).trim();

    if (!cleanText || cleanText.length === 0) return;

    const message = cleanText.substring(0, 100);
    io.emit('chat_message', {
      id: playerId,
      message
    });
  });

  socket.on('disconnect', () => {
    players.delete(playerId);
    io.emit('player_left', { id: playerId, totalPlayers: players.size });
  });
});

const TEST_PORT = 4571;
server.listen(TEST_PORT, async () => {
  console.log(`[TEST] Servidor de teste ouvindo na porta ${TEST_PORT}`);

  try {
    const client1 = Client(`http://localhost:${TEST_PORT}`);
    const client2 = Client(`http://localhost:${TEST_PORT}`);

    await Promise.all([
      new Promise((resolve) => client1.on('connect', resolve)),
      new Promise((resolve) => client2.on('connect', resolve))
    ]);

    console.log(`[TEST] Clientes conectados: C1=[${client1.id}], C2=[${client2.id}]`);

    // 1. Teste de Broadcast de Chat: Cliente 1 fala, ambos devem receber
    let client1ReceivedChat = null;
    let client2ReceivedChat = null;

    client1.on('chat_message', (data) => {
      client1ReceivedChat = data;
    });

    client2.on('chat_message', (data) => {
      client2ReceivedChat = data;
    });

    const testMessage = 'Olá a todos no Delteria!';
    client1.emit('chat_message', { message: testMessage });

    await new Promise((r) => setTimeout(r, 150));

    if (!client1ReceivedChat || client1ReceivedChat.message !== testMessage || client1ReceivedChat.id !== client1.id) {
      throw new Error(`Cliente 1 não recebeu seu próprio chat broadcast corretamente! Dados: ${JSON.stringify(client1ReceivedChat)}`);
    }

    if (!client2ReceivedChat || client2ReceivedChat.message !== testMessage || client2ReceivedChat.id !== client1.id) {
      throw new Error(`Cliente 2 não recebeu o chat broadcast de Cliente 1! Dados: ${JSON.stringify(client2ReceivedChat)}`);
    }

    console.log(`[TEST] ✅ Broadcast de chat recebido por todos os clientes: "${client2ReceivedChat.message}" de [${client2ReceivedChat.id}]`);

    // 2. Teste de Colisão Autoritativa
    let currentX = 48;
    client1.on('player_moved', (data) => {
      if (data.id === client1.id) currentX = data.x;
    });

    for (let i = 0; i < 20; i++) {
      client1.emit('player_move', { left: true, direction: 'left' });
      await new Promise((r) => setTimeout(r, 10));
    }
    await new Promise((r) => setTimeout(r, 100));

    if (currentX < 42) {
      throw new Error(`HACK DETECTADO: Jogador conseguiu atravessar a parede! X=${currentX}`);
    }
    console.log(`[TEST] ✅ Colisão autoritativa bloqueou parede com sucesso em X=${currentX}`);

    client1.disconnect();
    client2.disconnect();
    console.log('[TEST] TODOS OS TESTES DE CHAT, WEBSOCKET E COLISÃO PASSARAM! ✅');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('[TEST] Falha no teste:', err);
    server.close(() => process.exit(1));
  }
});
