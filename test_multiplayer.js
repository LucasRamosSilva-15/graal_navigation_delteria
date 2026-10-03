import { io as Client } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o mesmo map.json
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
  // Posiciona o jogador logo ao lado de uma parede sólida em (x=16, y=50) onde x=0 é parede sólida
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

  socket.on('disconnect', () => {
    players.delete(playerId);
    io.emit('player_left', { id: playerId, totalPlayers: players.size });
  });
});

const TEST_PORT = 4570;
server.listen(TEST_PORT, async () => {
  console.log(`[TEST] Servidor de teste ouvindo na porta ${TEST_PORT}`);

  try {
    const client = Client(`http://localhost:${TEST_PORT}`);

    await new Promise((resolve) => {
      client.on('connect', () => {
        console.log(`[TEST] Cliente conectado: [${client.id}]`);
        resolve();
      });
    });

    let currentX = 48;
    let currentY = 50;

    client.on('player_moved', (data) => {
      currentX = data.x;
      currentY = data.y;
    });

    // 1. Teste de Movimento Válido: Mover para a direita (área livre)
    console.log('[TEST] 1. Testando movimento em área livre (para a direita)...');
    client.emit('player_move', { right: true, direction: 'right' });
    await new Promise((r) => setTimeout(r, 100));

    if (currentX <= 48) {
      throw new Error(`Esperava que o jogador se movesse para a direita (> 48), mas obteve X=${currentX}`);
    }
    console.log(`[TEST] ✅ Movimento livre permitido com sucesso! X=${currentX}`);

    // 2. Teste de Colisão Autoritativa: Tentar andar para a esquerda em direção à parede sólida (x=0)
    console.log('[TEST] 2. Testando bloqueio contra parede sólida (para a esquerda repetidas vezes)...');
    // Força 20 passos para a esquerda tentando passar pela parede em x=0..32
    for (let i = 0; i < 20; i++) {
      client.emit('player_move', { left: true, direction: 'left' });
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 100));

    // A parede esquerda ocupa de x=0 a x=32. Com hitbox half=10, o jogador não pode ter X < 42
    if (currentX < 42) {
      throw new Error(`HACK DETECTADO: Jogador conseguiu atravessar a parede! X=${currentX}`);
    }
    console.log(`[TEST] ✅ Colisão autoritativa impediu atravessar a parede! Posição bloqueada em X=${currentX}`);

    // 3. Teste de colisão no Lago de Água (x: 27..34 tiles -> 864..1088px, y: 4..9 tiles -> 128..288px)
    const inWater = checkCollision(28 * 32, 6 * 32);
    if (!inWater) {
      throw new Error('A água deveria ser considerada colisão no servidor!');
    }
    console.log('[TEST] ✅ Água da camada Colisao validada como sólida no servidor!');

    client.disconnect();
    console.log('[TEST] TODOS OS TESTES DE TILED MAP E COLISÃO AUTORITATIVA PASSARAM! ✅');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('[TEST] Falha no teste:', err);
    server.close(() => process.exit(1));
  }
});
