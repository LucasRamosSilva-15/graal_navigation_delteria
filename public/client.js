// Conexão com o servidor Socket.io
const socket = io();

// Elementos da interface
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const myPlayerIdEl = document.getElementById('myPlayerId');
const myColorPreviewEl = document.getElementById('myColorPreview');
const myColorTextEl = document.getElementById('myColorText');
const serverInfoEl = document.getElementById('serverInfo');
const playerCountEl = document.getElementById('playerCount');
const playersListEl = document.getElementById('playersList');
const eventLogsEl = document.getElementById('eventLogs');
const playerCoordsEl = document.getElementById('playerCoords');
const fpsCounterEl = document.getElementById('fpsCounter');

// Canvas e Contexto 2D
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myId = null;
let currentPlayers = new Map();
let worldConfig = {
  width: 800,
  height: 500,
  playerSize: 26
};

// Rastreamento de teclas pressionadas (WASD e Setas)
const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

// Mapeamento de KeyCode para direções
function updateKeyState(code, isPressed) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.up = isPressed;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.down = isPressed;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = isPressed;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = isPressed;
      break;
  }
}

window.addEventListener('keydown', (e) => {
  // Evita scroll da página ao usar as setas
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  updateKeyState(e.code, true);
});

window.addEventListener('keyup', (e) => {
  updateKeyState(e.code, false);
});

// Loop de envio de inputs para o servidor (60Hz / taxa suave)
function startInputLoop() {
  setInterval(() => {
    if (!socket.connected || !myId) return;

    if (keys.up || keys.down || keys.left || keys.right) {
      socket.emit('player_move', {
        up: keys.up,
        down: keys.down,
        left: keys.left,
        right: keys.right
      });
    }
  }, 1000 / 60); // 60 updates por segundo
}

// Função auxiliar para registrar logs no terminal da tela
function appendScreenLog(message, type = 'normal') {
  if (!eventLogsEl) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span class="log-msg ${type}">${message}</span>
  `;
  eventLogsEl.appendChild(entry);
  eventLogsEl.scrollTop = eventLogsEl.scrollHeight;
}

// Atualiza a lista visual de jogadores no DOM
function renderPlayersList() {
  if (!playersListEl) return;
  playersListEl.innerHTML = '';
  playerCountEl.textContent = currentPlayers.size;

  if (currentPlayers.size === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'player-item';
    emptyLi.style.color = 'var(--text-muted)';
    emptyLi.textContent = 'Nenhum jogador conectado';
    playersListEl.appendChild(emptyLi);
    return;
  }

  currentPlayers.forEach((player, id) => {
    const li = document.createElement('li');
    const isMe = id === myId;
    li.className = `player-item ${isMe ? 'is-me' : ''}`;
    
    li.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${player.color || '#fff'};"></span>
        <span>${player.id}</span>
      </div>
      ${isMe ? '<span class="tag">VOCÊ</span>' : ''}
    `;
    playersListEl.appendChild(li);
  });
}

// 1. Evento de Conexão com o Servidor
socket.on('connect', () => {
  myId = socket.id;
  
  // Imprime exatamente no console do navegador como solicitado: 'Conectado como [ID]'
  console.log(`Conectado como [${myId}]`);

  // Atualiza UI
  statusBadge.className = 'badge online';
  statusText.textContent = 'Online';
  myPlayerIdEl.textContent = myId;
  serverInfoEl.textContent = 'Conectado via WebSocket';

  appendScreenLog(`Conectado como [${myId}]`, 'system');
});

// 2. Evento 'init' emitido pelo servidor com o mundo e jogadores já online
socket.on('init', (data) => {
  currentPlayers.clear();

  if (data.world) {
    worldConfig = data.world;
    canvas.width = worldConfig.width;
    canvas.height = worldConfig.height;
  }

  if (Array.isArray(data.players)) {
    data.players.forEach(p => {
      currentPlayers.set(p.id, p);
      if (p.id === myId) {
        myColorPreviewEl.style.backgroundColor = p.color;
        myColorTextEl.textContent = p.color;
        playerCoordsEl.textContent = `X: ${Math.round(p.x)} | Y: ${Math.round(p.y)}`;
      }
    });
  }
  renderPlayersList();
});

// 3. Notificação: Novo jogador entrou no servidor
socket.on('player_joined', (data) => {
  console.log(`Novo jogador entrou: [${data.id}] | Total: ${data.totalPlayers}`);
  
  currentPlayers.set(data.id, data);
  renderPlayersList();

  appendScreenLog(`Jogador [${data.id}] entrou na partida! (Total: ${data.totalPlayers})`, 'join');
});

// 4. Notificação: Posição do jogador atualizada pelo servidor
socket.on('player_moved', (data) => {
  const player = currentPlayers.get(data.id);
  if (player) {
    player.x = data.x;
    player.y = data.y;

    if (data.id === myId) {
      playerCoordsEl.textContent = `X: ${Math.round(data.x)} | Y: ${Math.round(data.y)}`;
    }
  }
});

// 5. Notificação: Um jogador saiu do servidor
socket.on('player_left', (data) => {
  console.log(`Jogador saiu: [${data.id}] | Total: ${data.totalPlayers}`);
  
  currentPlayers.delete(data.id);
  renderPlayersList();

  appendScreenLog(`Jogador [${data.id}] desconectou. (Total: ${data.totalPlayers})`, 'leave');
});

// 6. Evento de Desconexão local
socket.on('disconnect', (reason) => {
  console.warn(`Desconectado do servidor. Motivo: ${reason}`);
  
  statusBadge.className = 'badge offline';
  statusText.textContent = 'Desconectado';
  myPlayerIdEl.textContent = 'Desconectado';
  serverInfoEl.textContent = `Desconectado (${reason})`;

  appendScreenLog(`Conexão perdida com o servidor (${reason})`, 'leave');
});

// ==========================================
// RENDERIZAÇÃO COM CANVAS API NATIVA HTML5
// ==========================================

let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = performance.now();

function render(currentTime) {
  // Cálculo de FPS
  frameCount++;
  if (currentTime - lastFpsUpdate >= 500) {
    const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
    fpsCounterEl.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFpsUpdate = currentTime;
  }

  // 1. Limpa o Canvas com fundo da arena
  ctx.fillStyle = '#070a10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Desenha Grid sutil de fundo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;

  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 3. Renderiza cada jogador como um pequeno quadrado colorido
  const pSize = worldConfig.playerSize || 26;

  currentPlayers.forEach((player, id) => {
    const isMe = id === myId;
    const px = player.x || 0;
    const py = player.y || 0;
    const color = player.color || '#3a7bd5';

    // Sombra / Brilho
    ctx.save();
    if (isMe) {
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur = 10;
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }

    // Corpo do quadrado do jogador
    ctx.fillStyle = color;
    ctx.fillRect(px, py, pSize, pSize);

    // Contorno
    ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = isMe ? 2 : 1;
    ctx.strokeRect(px, py, pSize, pSize);
    ctx.restore();

    // Rótulo de identificação sobre a cabeça do quadrado
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    
    if (isMe) {
      ctx.fillStyle = '#00d2ff';
      ctx.fillText('VOCÊ', px + pSize / 2, py - 6);
    } else {
      ctx.fillStyle = 'rgba(240, 240, 240, 0.75)';
      const shortId = player.id.substring(0, 5);
      ctx.fillText(shortId, px + pSize / 2, py - 6);
    }
  });

  requestAnimationFrame(render);
}

// Inicia os loops
startInputLoop();
requestAnimationFrame(render);
