import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
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

// Configurações do mundo e física do jogo
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 500;
const PLAYER_SIZE = 26;
const PLAYER_SPEED = 5;

// Gera uma cor distinta para cada jogador com base no ID
function generateColorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 80%, 60%)`;
}

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Estado dos jogadores em memória
const players = new Map();

io.on('connection', (socket) => {
  const playerId = socket.id;

  // Posição inicial segura dentro do canvas
  const startX = Math.floor(Math.random() * (WORLD_WIDTH - PLAYER_SIZE - 60)) + 30;
  const startY = Math.floor(Math.random() * (WORLD_HEIGHT - PLAYER_SIZE - 60)) + 30;
  const playerColor = generateColorFromId(playerId);

  const playerData = {
    id: playerId,
    x: startX,
    y: startY,
    color: playerColor,
    connectedAt: new Date().toISOString()
  };

  // Registra o jogador no servidor
  players.set(playerId, playerData);

  console.log(`[+] Jogador conectado: ${playerId} em (${startX}, ${startY}) | Total online: ${players.size}`);

  // Envia ao jogador que conectou o seu ID, configurações do mundo e a lista completa de jogadores
  socket.emit('init', {
    id: playerId,
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      playerSize: PLAYER_SIZE
    },
    players: Array.from(players.values())
  });

  // Notifica todos os outros clientes que um novo jogador entrou com suas propriedades
  socket.broadcast.emit('player_joined', {
    ...playerData,
    totalPlayers: players.size
  });

  // Trata evento de movimentação do jogador (WASD / Setas)
  socket.on('player_move', (input) => {
    const player = players.get(playerId);
    if (!player) return;

    let dx = 0;
    let dy = 0;

    // Suporta input tanto por booleans (up, down, left, right) quanto por deltas (dx, dy)
    if (input.left) dx -= PLAYER_SPEED;
    if (input.right) dx += PLAYER_SPEED;
    if (input.up) dy -= PLAYER_SPEED;
    if (input.down) dy += PLAYER_SPEED;

    if (input.dx !== undefined) dx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, input.dx));
    if (input.dy !== undefined) dy = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, input.dy));

    if (dx !== 0 || dy !== 0) {
      // Atualiza posição garantindo os limites do canvas
      player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, player.x + dx));
      player.y = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, player.y + dy));

      // Broadcast imediato para todos os clientes conectados (sincronização sem atrasos)
      io.emit('player_moved', {
        id: playerId,
        x: player.x,
        y: player.y
      });
    }
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    players.delete(playerId);
    console.log(`[-] Jogador desconectado: ${playerId} | Total online: ${players.size}`);

    // Notifica todos os clientes conectados que o jogador saiu
    io.emit('player_left', {
      id: playerId,
      totalPlayers: players.size
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🎮 Servidor Multiplayer rodando!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`===========================================\n`);
});
