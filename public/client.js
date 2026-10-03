// ==========================================
// CONEXÃO SOCKET.IO E ESTADO GLOBAIS
// ==========================================
const socket = io();

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const myPlayerIdEl = document.getElementById('myPlayerId');
const serverInfoEl = document.getElementById('serverInfo');
const playerCountEl = document.getElementById('playerCount');
const playersListEl = document.getElementById('playersList');
const eventLogsEl = document.getElementById('eventLogs');
const playerCoordsEl = document.getElementById('playerCoords');
const fpsCounterEl = document.getElementById('fpsCounter');

let myId = null;
let currentPlayersData = new Map();
let worldConfig = {
  width: 1280,
  height: 960,
  tileSize: 32,
  mapWidth: 40,
  mapHeight: 30,
  speed: 5
};

let activeGameScene = null;

// Função auxiliar para logs na tela
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
  playerCountEl.textContent = currentPlayersData.size;

  if (currentPlayersData.size === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'player-item';
    emptyLi.style.color = 'var(--text-muted)';
    emptyLi.textContent = 'Nenhum jogador conectado';
    playersListEl.appendChild(emptyLi);
    return;
  }

  currentPlayersData.forEach((player, id) => {
    const li = document.createElement('li');
    const isMe = id === myId;
    li.className = `player-item ${isMe ? 'is-me' : ''}`;
    
    li.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${player.color || '#3a7bd5'};"></span>
        <span>${player.id}</span>
      </div>
      ${isMe ? '<span class="tag">VOCÊ</span>' : ''}
    `;
    playersListEl.appendChild(li);
  });
}

// ==========================================
// CENA PRINCIPAL DO PHASER (GameScene)
// ==========================================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.playerEntities = new Map();
    this.localPlayer = null;
    this.cursors = null;
    this.wasd = null;
    this.lastInputSent = { up: false, down: false, left: false, right: false };
    this.currentDirection = 'down';
    this.map = null;
    this.groundLayer = null;
    this.collisionLayer = null;
  }

  preload() {
    // 1. Carrega spritesheet do personagem (32x32)
    this.load.spritesheet('player', 'assets/player.png', {
      frameWidth: 32,
      frameHeight: 32
    });

    // 2. Carrega imagem do Tileset e Mapa JSON do Tiled
    this.load.image('tilesetImage', 'assets/tileset.png');
    this.load.tilemapTiledJSON('map', 'assets/map.json');
  }

  create() {
    activeGameScene = this;

    // 1. Criação do Tilemap a partir do JSON do Tiled
    this.map = this.make.tilemap({ key: 'map' });

    // Adiciona o tileset correspondente ao nome definido no Tiled ('delteria_tileset')
    const tileset = this.map.addTilesetImage('delteria_tileset', 'tilesetImage');

    // Cria as camadas do mapa
    this.groundLayer = this.map.createLayer('Ground', tileset, 0, 0);
    this.collisionLayer = this.map.createLayer('Colisao', tileset, 0, 0);

    // Configura colisões no Phaser: qualquer tile na camada Colisao com índice > 0 é colidível
    this.collisionLayer.setCollisionByExclusion([-1, 0]);

    // Atualiza dimensões do mundo com base no Tilemap
    worldConfig.width = this.map.widthInPixels;
    worldConfig.height = this.map.heightInPixels;
    worldConfig.tileSize = this.map.tileWidth;

    // 2. Criação das Animações: Idle e Walk nas 4 direções
    this.anims.create({
      key: 'idle-down',
      frames: [{ key: 'player', frame: 1 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 1] }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'idle-left',
      frames: [{ key: 'player', frame: 4 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('player', { frames: [3, 4, 5, 4] }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'idle-right',
      frames: [{ key: 'player', frame: 7 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('player', { frames: [6, 7, 8, 7] }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'idle-up',
      frames: [{ key: 'player', frame: 10 }],
      frameRate: 1
    });
    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('player', { frames: [9, 10, 11, 10] }),
      frameRate: 8,
      repeat: -1
    });

    // 3. Configura Câmera e Limites do Mundo
    this.cameras.main.setBounds(0, 0, worldConfig.width, worldConfig.height);
    this.physics.world.setBounds(0, 0, worldConfig.width, worldConfig.height);
    this.cameras.main.setZoom(1.25);

    // 4. Captura de Teclado
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE
    ]);

    // Instancia jogadores já presentes
    currentPlayersData.forEach(playerData => {
      this.addPlayer(playerData);
    });
  }

  // Checagem local de colisão no cliente para feedback visual imediato
  checkClientCollision(x, y) {
    if (!this.collisionLayer) return false;

    const half = 10;
    const corners = [
      { x: x - half, y: y - half },
      { x: x + half - 1, y: y - half },
      { x: x - half, y: y + half - 1 },
      { x: x + half - 1, y: y + half - 1 }
    ];

    for (const pt of corners) {
      if (pt.x < 0 || pt.x >= worldConfig.width || pt.y < 0 || pt.y >= worldConfig.height) {
        return true;
      }
      const tile = this.collisionLayer.getTileAtWorldXY(pt.x, pt.y, true);
      if (tile && tile.index > 0) {
        return true;
      }
    }
    return false;
  }

  // Cria ou adiciona um jogador na cena
  addPlayer(data) {
    if (this.playerEntities.has(data.id)) return;

    const isMe = data.id === myId;
    const x = data.x || 600;
    const y = data.y || 480;

    const sprite = this.add.sprite(0, 0, 'player', 1);
    sprite.setOrigin(0.5, 0.5);

    const labelText = isMe ? 'VOCÊ' : data.id.substring(0, 5);
    const labelColor = isMe ? '#00d2ff' : '#f3f4f6';
    const nameTag = this.add.text(0, -24, labelText, {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: isMe ? 'bold' : 'normal',
      color: labelColor,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 0.5);

    const containerChildren = [sprite, nameTag];
    if (isMe) {
      const ringGfx = this.add.graphics();
      ringGfx.lineStyle(2, 0x00d2ff, 0.8);
      ringGfx.strokeCircle(0, 10, 14);
      containerChildren.unshift(ringGfx);
    }

    const container = this.add.container(x, y, containerChildren);
    container.setSize(32, 32);

    const playerEntity = {
      id: data.id,
      container,
      sprite,
      nameTag,
      targetX: x,
      targetY: y,
      predictedX: x,
      predictedY: y,
      direction: data.direction || 'down',
      isMoving: false,
      isMe
    };

    this.playerEntities.set(data.id, playerEntity);
    sprite.play(`idle-${playerEntity.direction}`);

    if (isMe) {
      this.localPlayer = playerEntity;
      // Câmera segue permanentemente o jogador local
      this.cameras.main.startFollow(container, true, 0.1, 0.1);
      console.log(`[CAMERA] Câmera do Phaser travada e seguindo [${myId}]`);
    }
  }

  removePlayer(id) {
    const entity = this.playerEntities.get(id);
    if (entity) {
      entity.container.destroy();
      this.playerEntities.delete(id);
    }
  }

  updatePlayerPosition(id, x, y, direction, isMoving) {
    const entity = this.playerEntities.get(id);
    if (!entity) return;

    entity.targetX = x;
    entity.targetY = y;
    if (direction) entity.direction = direction;
    entity.isMoving = !!isMoving;

    if (!entity.isMe) {
      const animKey = entity.isMoving ? `walk-${entity.direction}` : `idle-${entity.direction}`;
      if (entity.sprite.anims.currentAnim?.key !== animKey) {
        entity.sprite.play(animKey, true);
      }
    } else {
      // Reconciliação autoritativa do servidor
      // Se a discrepância for muito grande (tentativa de atravessar parede ou teleporte), corrige
      const dist = Phaser.Math.Distance.Between(entity.container.x, entity.container.y, x, y);
      if (dist > 30) {
        entity.container.x = x;
        entity.container.y = y;
        entity.predictedX = x;
        entity.predictedY = y;
      }
    }
  }

  update(time, delta) {
    if (fpsCounterEl) {
      fpsCounterEl.textContent = `FPS: ${Math.round(this.game.loop.actualFps)}`;
    }

    // Processamento do jogador local
    if (this.localPlayer && this.localPlayer.container) {
      const up = this.cursors.up.isDown || this.wasd.up.isDown;
      const down = this.cursors.down.isDown || this.wasd.down.isDown;
      const left = this.cursors.left.isDown || this.wasd.left.isDown;
      const right = this.cursors.right.isDown || this.wasd.right.isDown;

      const isMoving = up || down || left || right;

      if (left) this.currentDirection = 'left';
      else if (right) this.currentDirection = 'right';
      else if (up) this.currentDirection = 'up';
      else if (down) this.currentDirection = 'down';

      this.localPlayer.direction = this.currentDirection;

      // Animação local
      const animKey = isMoving ? `walk-${this.currentDirection}` : `idle-${this.currentDirection}`;
      if (this.localPlayer.sprite.anims.currentAnim?.key !== animKey) {
        this.localPlayer.sprite.play(animKey, true);
      }

      // FEEDBACK VISUAL IMEDIATO COM COLISÃO LOCAL:
      // Testa movimento em X e Y separadamente (wall slide)
      const speed = worldConfig.speed || 5;
      let moveDx = 0;
      let moveDy = 0;

      if (left) moveDx -= speed;
      if (right) moveDx += speed;
      if (up) moveDy -= speed;
      if (down) moveDy += speed;

      if (moveDx !== 0) {
        const nextX = this.localPlayer.container.x + moveDx;
        if (!this.checkClientCollision(nextX, this.localPlayer.container.y)) {
          this.localPlayer.container.x = nextX;
        }
      }

      if (moveDy !== 0) {
        const nextY = this.localPlayer.container.y + moveDy;
        if (!this.checkClientCollision(this.localPlayer.container.x, nextY)) {
          this.localPlayer.container.y = nextY;
        }
      }

      // Envia evento de input para o servidor autoritativo
      const inputChanged = up !== this.lastInputSent.up ||
                           down !== this.lastInputSent.down ||
                           left !== this.lastInputSent.left ||
                           right !== this.lastInputSent.right;

      if (isMoving || inputChanged) {
        socket.emit('player_move', {
          up,
          down,
          left,
          right,
          direction: this.currentDirection,
          isMoving
        });

        this.lastInputSent = { up, down, left, right };
      }

      // Atualiza mostrador de coordenadas
      if (playerCoordsEl) {
        playerCoordsEl.textContent = `X: ${Math.round(this.localPlayer.container.x)} | Y: ${Math.round(this.localPlayer.container.y)}`;
      }
    }

    // Interpolação suave dos outros jogadores
    this.playerEntities.forEach((entity, id) => {
      if (entity.isMe) return;
      entity.container.x = Phaser.Math.Linear(entity.container.x, entity.targetX, 0.3);
      entity.container.y = Phaser.Math.Linear(entity.container.y, entity.targetY, 0.3);
    });
  }
}

// Configuração do Phaser Game
const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'gameContainer',
  width: 800,
  height: 500,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [GameScene]
};

const game = new Phaser.Game(phaserConfig);

// ==========================================
// EVENTOS SOCKET.IO
// ==========================================
socket.on('connect', () => {
  myId = socket.id;
  console.log(`Conectado como [${myId}]`);

  statusBadge.className = 'badge online';
  statusText.textContent = 'Online';
  myPlayerIdEl.textContent = myId;
  serverInfoEl.textContent = 'Conectado (Tiled Map & Colisão Autoritativa)';

  appendScreenLog(`Conectado como [${myId}]`, 'system');
});

socket.on('init', (data) => {
  currentPlayersData.clear();

  if (data.world) {
    worldConfig = { ...worldConfig, ...data.world };
    if (activeGameScene && activeGameScene.cameras) {
      activeGameScene.cameras.main.setBounds(0, 0, worldConfig.width, worldConfig.height);
      activeGameScene.physics.world.setBounds(0, 0, worldConfig.width, worldConfig.height);
    }
  }

  if (Array.isArray(data.players)) {
    data.players.forEach(p => {
      currentPlayersData.set(p.id, p);
      if (activeGameScene) {
        activeGameScene.addPlayer(p);
      }
    });
  }

  renderPlayersList();
});

socket.on('player_joined', (data) => {
  console.log(`Novo jogador entrou: [${data.id}] em (${data.x}, ${data.y}) | Total: ${data.totalPlayers}`);

  currentPlayersData.set(data.id, data);
  renderPlayersList();

  if (activeGameScene) {
    activeGameScene.addPlayer(data);
  }

  appendScreenLog(`Jogador [${data.id.substring(0, 6)}...] entrou na partida! (Total: ${data.totalPlayers})`, 'join');
});

socket.on('player_moved', (data) => {
  const pData = currentPlayersData.get(data.id);
  if (pData) {
    pData.x = data.x;
    pData.y = data.y;
    pData.direction = data.direction;
    pData.isMoving = data.isMoving;
  }

  if (activeGameScene) {
    activeGameScene.updatePlayerPosition(data.id, data.x, data.y, data.direction, data.isMoving);
  }
});

socket.on('player_left', (data) => {
  console.log(`Jogador saiu: [${data.id}] | Total: ${data.totalPlayers}`);

  currentPlayersData.delete(data.id);
  renderPlayersList();

  if (activeGameScene) {
    activeGameScene.removePlayer(data.id);
  }

  appendScreenLog(`Jogador [${data.id.substring(0, 6)}...] desconectou. (Total: ${data.totalPlayers})`, 'leave');
});

socket.on('disconnect', (reason) => {
  console.warn(`Desconectado do servidor. Motivo: ${reason}`);

  statusBadge.className = 'badge offline';
  statusText.textContent = 'Desconectado';
  myPlayerIdEl.textContent = 'Desconectado';
  serverInfoEl.textContent = `Desconectado (${reason})`;

  appendScreenLog(`Conexão perdida com o servidor (${reason})`, 'leave');
});
