import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_WIDTH = 40;
const MAP_HEIGHT = 30;
const TILE_SIZE = 32;

// GIDs:
// 1 = Grama, 2 = Terra, 3 = Pedra Calçada, 4 = Água
// 5 = Parede Pedra, 6 = Rocha, 7 = Cerca, 8 = Tijolo Casa
const groundData = new Array(MAP_WIDTH * MAP_HEIGHT).fill(1); // Tudo grama inicialmente
const collisionData = new Array(MAP_WIDTH * MAP_HEIGHT).fill(0); // 0 = sem colisão

function getIndex(x, y) {
  return y * MAP_WIDTH + x;
}

// 1. Desenhar caminhos de terra e pedra na camada Ground
for (let x = 0; x < MAP_WIDTH; x++) {
  // Estrada horizontal principal (y = 14 e 15)
  groundData[getIndex(x, 14)] = 2;
  groundData[getIndex(x, 15)] = 2;
}
for (let y = 0; y < MAP_HEIGHT; y++) {
  // Estrada vertical principal (x = 19 e 20)
  groundData[getIndex(19, y)] = 2;
  groundData[getIndex(20, y)] = 2;
}
// Praça central com calçamento de pedra (x: 17..22, y: 12..17)
for (let y = 12; y <= 17; y++) {
  for (let x = 17; x <= 22; x++) {
    groundData[getIndex(x, y)] = 3;
  }
}

// 2. Desenhar Paredes Externas na camada Colisao
for (let x = 0; x < MAP_WIDTH; x++) {
  collisionData[getIndex(x, 0)] = 5; // Topo
  collisionData[getIndex(x, MAP_HEIGHT - 1)] = 5; // Base
}
for (let y = 0; y < MAP_HEIGHT; y++) {
  collisionData[getIndex(0, y)] = 5; // Esquerda
  collisionData[getIndex(MAP_WIDTH - 1, y)] = 5; // Direita
}

// 3. Desenhar Lago de Água (Colisão) no canto superior direito (x: 27..34, y: 4..9)
for (let y = 4; y <= 9; y++) {
  for (let x = 27; x <= 34; x++) {
    collisionData[getIndex(x, y)] = 4; // Água
  }
}

// 4. Desenhar Casa / Construção de Tijolos no quadrante superior esquerdo (x: 5..12, y: 4..9)
for (let y = 4; y <= 9; y++) {
  for (let x = 5; x <= 12; x++) {
    // Paredes da casa com porta aberta em (x: 8, y: 9)
    if (y === 4 || y === 9 || x === 5 || x === 12) {
      if (!(x === 8 && y === 9)) { // Entrada livre
        collisionData[getIndex(x, y)] = 8; // Parede tijolo
      }
    }
  }
}

// 5. Desenhar Fortaleza de Pedra no quadrante inferior direito (x: 25..34, y: 20..26)
for (let y = 20; y <= 26; y++) {
  for (let x = 25; x <= 34; x++) {
    if (y === 20 || y === 26 || x === 25 || x === 34) {
      if (!(x === 29 && y === 20)) { // Entrada livre no topo
        collisionData[getIndex(x, y)] = 5; // Parede de pedra
      }
    }
  }
}

// 6. Cercas de madeira (Colisão) no quadrante inferior esquerdo (x: 4..14, y: 22)
for (let x = 4; x <= 14; x++) {
  if (x !== 9) { // Portão aberto em x=9
    collisionData[getIndex(x, 22)] = 7; // Cerca
  }
}

// 7. Rochas espalhadas
const rocks = [
  [15, 6], [16, 7], [14, 8],
  [23, 11], [24, 12],
  [12, 17], [13, 18],
  [7, 16], [8, 17]
];
for (const [rx, ry] of rocks) {
  collisionData[getIndex(rx, ry)] = 6; // Rocha sólida
}

// Montagem do Tiled Map JSON
const tiledMap = {
  compressionlevel: -1,
  height: MAP_HEIGHT,
  width: MAP_WIDTH,
  infinite: false,
  layers: [
    {
      data: groundData,
      height: MAP_HEIGHT,
      id: 1,
      name: "Ground",
      opacity: 1,
      type: "tilelayer",
      visible: true,
      width: MAP_WIDTH,
      x: 0,
      y: 0
    },
    {
      data: collisionData,
      height: MAP_HEIGHT,
      id: 2,
      name: "Colisao",
      opacity: 1,
      type: "tilelayer",
      visible: true,
      width: MAP_WIDTH,
      x: 0,
      y: 0,
      properties: [
        {
          name: "collides",
          type: "bool",
          value: true
        }
      ]
    }
  ],
  nextlayerid: 3,
  nextobjectid: 1,
  orientation: "orthogonal",
  renderorder: "right-down",
  tiledversion: "1.10.2",
  tileheight: TILE_SIZE,
  tilesets: [
    {
      columns: 4,
      firstgid: 1,
      image: "tileset.png",
      imageheight: 64,
      imagewidth: 128,
      margin: 0,
      name: "delteria_tileset",
      spacing: 0,
      tilecount: 8,
      tileheight: TILE_SIZE,
      tilewidth: TILE_SIZE,
      tiles: [
        { id: 3, properties: [{ name: "collides", type: "bool", value: true }] },
        { id: 4, properties: [{ name: "collides", type: "bool", value: true }] },
        { id: 5, properties: [{ name: "collides", type: "bool", value: true }] },
        { id: 6, properties: [{ name: "collides", type: "bool", value: true }] },
        { id: 7, properties: [{ name: "collides", type: "bool", value: true }] }
      ]
    }
  ],
  tilewidth: TILE_SIZE,
  type: "map",
  version: "1.10"
};

const mapJsonPath = path.join(__dirname, 'public', 'assets', 'map.json');
fs.writeFileSync(mapJsonPath, JSON.stringify(tiledMap, null, 2), 'utf-8');
console.log(`[MAP] map.json gerado com sucesso em ${mapJsonPath} (${MAP_WIDTH}x${MAP_HEIGHT} tiles, ${MAP_WIDTH * TILE_SIZE}x${MAP_HEIGHT * TILE_SIZE}px)`);
