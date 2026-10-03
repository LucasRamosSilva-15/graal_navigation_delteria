import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CARREGAMENTO AUTORITATIVO DO MAPA TILED JSON
// ==========================================
const mapFilePath = path.join(__dirname, 'public', 'assets', 'map.json');
let mapData = null;
let collisionLayerData = null;
let MAP_WIDTH = 40;
let MAP_HEIGHT = 30;
let TILE_SIZE = 32;

try {
  const rawMap = fs.readFileSync(mapFilePath, 'utf-8');
  mapData = JSON.parse(rawMap);
  MAP_WIDTH = mapData.width;
  MAP_HEIGHT = mapData.height;
  TILE_SIZE = mapData.tilewidth;

  const collisionLayer = mapData.layers.find(l => l.name === 'Colisao');
  if (collisionLayer) {
    collisionLayerData = collisionLayer.data;
    console.log(`[MAPA] Camada 'Colisao' carregada no servidor: ${collisionLayerData.length} tiles.`);
  } else {
    console.warn("[MAPA] ATENÇÃO: Camada 'Colisao' não encontrada no JSON do mapa!");
  }
} catch (err) {
  console.error('[MAPA] Erro ao carregar mapa JSON:', err);
}

const WORLD_WIDTH = MAP_WIDTH * TILE_SIZE;   // 1280px
const WORLD_HEIGHT = MAP_HEIGHT * TILE_SIZE; // 960px
const PLAYER_SPEED = 5;

// Hitbox do jogador para verificação precisa de colisão nos pés/corpo (20x20px)
const HITBOX_HALF_SIZE = 10;

// Função autoritativa de checagem de colisão no servidor
export function checkCollision(x, y) {
  if (!collisionLayerData) return false;

  // Bounding box dos 4 cantos da hitbox
  const corners = [
    { x: x - HITBOX_HALF_SIZE, y: y - HITBOX_HALF_SIZE },
    { x: x + HITBOX_HALF_SIZE - 1, y: y - HITBOX_HALF_SIZE },
    { x: x - HITBOX_HALF_SIZE, y: y + HITBOX_HALF_SIZE - 1 },
    { x: x + HITBOX_HALF_SIZE - 1, y: y + HITBOX_HALF_SIZE - 1 }
  ];

  for (const pt of corners) {
    // Fora dos limites do mundo
    if (pt.x < 0 || pt.x >= WORLD_WIDTH || pt.y < 0 || pt.y >= WORLD_HEIGHT) {
      return true;
    }

    const tileX = Math.floor(pt.x / TILE_SIZE);
    const tileY = Math.floor(pt.y / TILE_SIZE);
    const index = tileY * MAP_WIDTH + tileX;

    // Tile com ID > 0 na camada Colisao indica barreira sólida
    if (collisionLayerData[index] && collisionLayerData[index] > 0) {
      return true;
    }
  }

  return false;
}

// Encontra um ponto de spawn seguro sem colisão
function getSafeSpawn() {
  for (let i = 0; i < 150; i++) {
    // Tenta spawn na área aberta (próximo à praça central)
    const rx = Math.floor(Math.random() * 8 + 16) * TILE_SIZE + 16;
    const ry = Math.floor(Math.random() * 6 + 12) * TILE_SIZE + 16;
    if (!checkCollision(rx, ry)) {
      return { x: rx, y: ry };
    }
  }
  return { x: 20 * TILE_SIZE, y: 15 * TILE_SIZE };
}

// Gera cor única para o jogador
function generateColorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 80%, 60%)`;
}

// Servir arquivos estáticos do cliente
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libs/phaser', express.static(path.join(__dirname, 'node_modules/phaser/dist')));

// Estado dos jogadores em memória
const players = new Map();

io.on('connection', (socket) => {
  const playerId = socket.id;
  const spawn = getSafeSpawn();
  const playerColor = generateColorFromId(playerId);

  const playerData = {
    id: playerId,
    x: spawn.x,
    y: spawn.y,
    direction: 'down',
    isMoving: false,
    color: playerColor,
    connectedAt: new Date().toISOString()
  };

  players.set(playerId, playerData);

  console.log(`[+] Jogador conectado: ${playerId} em (${spawn.x}, ${spawn.y}) | Total online: ${players.size}`);

  // Envia ao jogador que conectou o seu ID, configurações do mundo e a lista completa de jogadores
  socket.emit('init', {
    id: playerId,
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      tileSize: TILE_SIZE,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      speed: PLAYER_SPEED
    },
    players: Array.from(players.values())
  });

  // Notifica todos os outros clientes que um novo jogador entrou
  socket.broadcast.emit('player_joined', {
    ...playerData,
    totalPlayers: players.size
  });

  // Trata movimentação com VALIDAÇÃO AUTORITATIVA DE COLISÃO
  socket.on('player_move', (input) => {
    const player = players.get(playerId);
    if (!player) return;

    let dx = 0;
    let dy = 0;

    if (input.left) {
      dx -= PLAYER_SPEED;
      player.direction = 'left';
    }
    if (input.right) {
      dx += PLAYER_SPEED;
      player.direction = 'right';
    }
    if (input.up) {
      dy -= PLAYER_SPEED;
      player.direction = 'up';
    }
    if (input.down) {
      dy += PLAYER_SPEED;
      player.direction = 'down';
    }

    if (input.direction) {
      player.direction = input.direction;
    }

    const isMoving = dx !== 0 || dy !== 0 || !!input.isMoving;
    player.isMoving = isMoving;

    // VALIDAÇÃO AUTORITATIVA DE COLISÃO:
    // Permite deslizar suavemente pelas paredes (wall sliding) testando X e Y separadamente
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

    // Broadcast da posição validada no servidor para todos os clientes
    io.emit('player_moved', {
      id: playerId,
      x: player.x,
      y: player.y,
      direction: player.direction,
      isMoving: player.isMoving
    });
  });

  // Evento de Chat Global (Speech Bubbles)
  socket.on('chat_message', (msg) => {
    const rawText = typeof msg === 'string' ? msg : (msg && msg.message ? msg.message : '');
    const cleanText = String(rawText).trim();

    if (!cleanText || cleanText.length === 0) return;

    // Limita tamanho para evitar flood
    const message = cleanText.substring(0, 100);
    console.log(`[CHAT] [${playerId}]: ${message}`);

    // Broadcast para todos os clientes conectados (incluindo o remetente)
    io.emit('chat_message', {
      id: playerId,
      message
    });
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    players.delete(playerId);
    console.log(`[-] Jogador desconectado: ${playerId} | Total online: ${players.size}`);

    io.emit('player_left', {
      id: playerId,
      totalPlayers: players.size
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERRO: A porta ${PORT} já está em uso!`);
    console.error(`💡 Use o comando: lsof -t -i:${PORT} | xargs -r kill -9\n`);
  } else {
    console.error('Erro no servidor HTTP:', err);
  }
});

server.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🎮 Servidor Multiplayer Delteria rodando!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🗺️  Mapa Tiled: ${MAP_WIDTH}x${MAP_HEIGHT} tiles (${WORLD_WIDTH}x${WORLD_HEIGHT}px)`);
  console.log(`🛡️  Colisão Autoritativa: ATIVADA`);
  console.log(`===========================================\n`);
});
