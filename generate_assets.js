import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper para criar buffer PNG válido
function createPNG(width, height, getPixelRGBA) {
  const rawBytes = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawBytes[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y);
      rawBytes[offset++] = r;
      rawBytes[offset++] = g;
      rawBytes[offset++] = b;
      rawBytes[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawBytes);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const typeAndData = chunk.subarray(4, 8 + len);
    chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
    return chunk;
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ==========================================
// 1. SPRITESHEET DO JOGADOR (96x128)
// ==========================================
const FRAME_W = 32;
const FRAME_H = 32;
const SHEET_W = FRAME_W * 3;
const SHEET_H = FRAME_H * 4;

function getPlayerPixel(x, y) {
  const col = Math.floor(x / FRAME_W);
  const row = Math.floor(y / FRAME_H);
  const lx = x % FRAME_W;
  const ly = y % FRAME_H;

  const cHair = [180, 83, 9, 255];
  const cSkin = [253, 224, 71, 255];
  const cEyes = [15, 23, 42, 255];
  const cShirt = [37, 99, 235, 255];
  const cBelt = [120, 53, 15, 255];
  const cBuckle = [234, 179, 8, 255];
  const cPants = [51, 65, 85, 255];
  const cBoots = [67, 20, 7, 255];
  const cShadow = [0, 0, 0, 60];
  const cNone = [0, 0, 0, 0];

  if (ly >= 28 && ly <= 31 && lx >= 8 && lx <= 23) return cShadow;

  // Linha 0: Down
  if (row === 0) {
    if (ly >= 4 && ly <= 7 && lx >= 10 && lx <= 21) return cHair;
    if (ly >= 8 && ly <= 11 && lx >= 9 && lx <= 22) {
      if (lx >= 10 && lx <= 21 && ly >= 9) return cSkin;
      return cHair;
    }
    if (ly >= 12 && ly <= 15 && lx >= 10 && lx <= 21) {
      if (ly === 12 && (lx === 13 || lx === 18)) return cEyes;
      if (ly === 13 && (lx === 13 || lx === 18)) return cEyes;
      return cSkin;
    }
    if (ly >= 16 && ly <= 21) {
      if (lx >= 11 && lx <= 20) return cShirt;
      if (col === 0 && ((lx >= 9 && lx <= 10 && ly <= 20) || (lx >= 21 && lx <= 22 && ly <= 22))) return cShirt;
      if (col === 1 && (lx >= 9 && lx <= 10 || lx >= 21 && lx <= 22)) return cShirt;
      if (col === 2 && ((lx >= 9 && lx <= 10 && ly <= 22) || (lx >= 21 && lx <= 22 && ly <= 20))) return cShirt;
    }
    if (ly === 22 && lx >= 11 && lx <= 20) {
      if (lx >= 15 && lx <= 16) return cBuckle;
      return cBelt;
    }
    if (ly >= 23 && ly <= 26) {
      if (col === 1 && ((lx >= 11 && lx <= 14) || (lx >= 17 && lx <= 20))) return cPants;
      if (col === 0 && ((lx >= 10 && lx <= 14) || (lx >= 17 && lx <= 19))) return cPants;
      if (col === 2 && ((lx >= 12 && lx <= 14) || (lx >= 17 && lx <= 21))) return cPants;
    }
    if (ly >= 27 && ly <= 29) {
      if (col === 1 && ((lx >= 11 && lx <= 14) || (lx >= 17 && lx <= 20))) return cBoots;
      if (col === 0 && ((lx >= 9 && lx <= 14 && ly <= 29) || (lx >= 17 && lx <= 19 && ly <= 28))) return cBoots;
      if (col === 2 && ((lx >= 12 && lx <= 14 && ly <= 28) || (lx >= 17 && lx <= 22 && ly <= 29))) return cBoots;
    }
  }

  // Linha 1: Left
  if (row === 1) {
    if (ly >= 4 && ly <= 8 && lx >= 9 && lx <= 20) return cHair;
    if (ly >= 9 && ly <= 15 && lx >= 9 && lx <= 20) {
      if (lx >= 9 && lx <= 14 && ly >= 10 && ly <= 14) {
        if (ly >= 12 && ly <= 13 && lx === 11) return cEyes;
        return cSkin;
      }
      return cHair;
    }
    if (ly >= 16 && ly <= 21 && lx >= 11 && lx <= 19) return cShirt;
    if (ly === 22 && lx >= 11 && lx <= 19) return lx === 12 ? cBuckle : cBelt;
    if (ly >= 23 && ly <= 26) {
      if (col === 1 && lx >= 12 && lx <= 17) return cPants;
      if (col === 0 && lx >= 9 && lx <= 15) return cPants;
      if (col === 2 && lx >= 14 && lx <= 20) return cPants;
    }
    if (ly >= 27 && ly <= 29) {
      if (col === 1 && lx >= 11 && lx <= 17) return cBoots;
      if (col === 0 && lx >= 8 && lx <= 14) return cBoots;
      if (col === 2 && lx >= 14 && lx <= 20) return cBoots;
    }
  }

  // Linha 2: Right
  if (row === 2) {
    if (ly >= 4 && ly <= 8 && lx >= 11 && lx <= 22) return cHair;
    if (ly >= 9 && ly <= 15 && lx >= 11 && lx <= 22) {
      if (lx >= 17 && lx <= 22 && ly >= 10 && ly <= 14) {
        if (ly >= 12 && ly <= 13 && lx === 20) return cEyes;
        return cSkin;
      }
      return cHair;
    }
    if (ly >= 16 && ly <= 21 && lx >= 12 && lx <= 20) return cShirt;
    if (ly === 22 && lx >= 12 && lx <= 20) return lx === 19 ? cBuckle : cBelt;
    if (ly >= 23 && ly <= 26) {
      if (col === 1 && lx >= 14 && lx <= 19) return cPants;
      if (col === 0 && lx >= 16 && lx <= 22) return cPants;
      if (col === 2 && lx >= 11 && lx <= 17) return cPants;
    }
    if (ly >= 27 && ly <= 29) {
      if (col === 1 && lx >= 14 && lx <= 20) return cBoots;
      if (col === 0 && lx >= 17 && lx <= 23) return cBoots;
      if (col === 2 && lx >= 11 && lx <= 17) return cBoots;
    }
  }

  // Linha 3: Up
  if (row === 3) {
    if (ly >= 4 && ly <= 14 && lx >= 9 && lx <= 22) return cHair;
    if (ly >= 15 && ly <= 21 && lx >= 10 && lx <= 21) return cShirt;
    if (ly === 22 && lx >= 11 && lx <= 20) return cBelt;
    if (ly >= 23 && ly <= 26) {
      if (col === 1 && ((lx >= 11 && lx <= 14) || (lx >= 17 && lx <= 20))) return cPants;
      if (col === 0 && ((lx >= 10 && lx <= 13) || (lx >= 17 && lx <= 21))) return cPants;
      if (col === 2 && ((lx >= 11 && lx <= 15) || (lx >= 18 && lx <= 21))) return cPants;
    }
    if (ly >= 27 && ly <= 29) {
      if (col === 1 && ((lx >= 11 && lx <= 14) || (lx >= 17 && lx <= 20))) return cBoots;
      if (col === 0 && ((lx >= 10 && lx <= 13) || (lx >= 17 && lx <= 21))) return cBoots;
      if (col === 2 && ((lx >= 11 && lx <= 15) || (lx >= 18 && lx <= 21))) return cBoots;
    }
  }

  return cNone;
}

// ==========================================
// 2. TILESET COMPLETO (128x64 -> 4 colunas x 2 linhas de 32x32)
// ==========================================
// Tile 1: Grama (Ground)
// Tile 2: Terra / Estrada (Ground)
// Tile 3: Calçamento de pedra (Ground)
// Tile 4: Água azul (Colisão)
// Tile 5: Parede de pedra cinza / castelo (Colisão)
// Tile 6: Rocha sólida (Colisão)
// Tile 7: Cerca de madeira (Colisão)
// Tile 8: Parede de tijolo marrom / casa (Colisão)
function getTilesetPixel(x, y) {
  const col = Math.floor(x / 32); // 0, 1, 2, 3
  const row = Math.floor(y / 32); // 0, 1
  const lx = x % 32;
  const ly = y % 32;

  // TILE 1 (col 0, row 0): Grama
  if (col === 0 && row === 0) {
    const baseGreen = [46, 125, 50, 255];
    const lightGreen = [56, 142, 60, 255];
    const darkGreen = [39, 105, 42, 255];
    if ((lx + ly * 3) % 13 === 0) return lightGreen;
    if ((lx * 5 + ly) % 19 === 0) return darkGreen;
    return baseGreen;
  }

  // TILE 2 (col 1, row 0): Terra / Estrada
  if (col === 1 && row === 0) {
    const baseDirt = [161, 110, 63, 255];
    const lightDirt = [180, 126, 76, 255];
    const darkDirt = [138, 92, 50, 255];
    const stone = [115, 115, 115, 255];
    if ((lx === 8 && ly === 10) || (lx === 22 && ly === 18)) return stone;
    if ((lx * 7 + ly * 3) % 11 === 0) return lightDirt;
    if ((lx + ly * 5) % 17 === 0) return darkDirt;
    return baseDirt;
  }

  // TILE 3 (col 2, row 0): Calçamento de pedra
  if (col === 2 && row === 0) {
    const stoneBase = [120, 130, 140, 255];
    const stoneBorder = [75, 85, 99, 255];
    const stoneHighlight = [160, 170, 180, 255];
    if (lx === 0 || lx === 16 || ly === 0 || ly === 16) return stoneBorder;
    if (lx === 1 || ly === 1 || lx === 17 || ly === 17) return stoneHighlight;
    return stoneBase;
  }

  // TILE 4 (col 3, row 0): Água azul (Colisão)
  if (col === 3 && row === 0) {
    const waterDeep = [14, 116, 144, 255];
    const waterWave = [56, 189, 248, 255];
    const waterShadow = [8, 47, 73, 255];
    if ((lx + ly) % 12 === 0 || (lx + 2 * ly) % 14 === 0) return waterWave;
    if ((lx * 2 + ly) % 18 === 0) return waterShadow;
    return waterDeep;
  }

  // TILE 5 (col 0, row 1): Parede de castelo (Colisão)
  if (col === 0 && row === 1) {
    const wallBase = [100, 110, 125, 255];
    const wallMortar = [30, 41, 59, 255];
    const wallTop = [148, 163, 184, 255];
    const wallShadow = [51, 65, 85, 255];

    if (ly <= 4) return wallTop;
    if (ly === 5 || ly === 15 || ly === 25 || ly === 31) return wallMortar;
    if ((ly > 5 && ly < 15 && (lx === 0 || lx === 16 || lx === 31)) ||
        (ly > 15 && ly < 25 && (lx === 8 || lx === 24))) {
      return wallMortar;
    }
    if (ly === 6 || ly === 16 || ly === 26) return wallShadow;
    return wallBase;
  }

  // TILE 6 (col 1, row 1): Rocha grande (Colisão)
  if (col === 1 && row === 1) {
    const bg = [46, 125, 50, 0]; // Transparente no entorno da rocha
    const rockLight = [156, 163, 175, 255];
    const rockMid = [107, 114, 128, 255];
    const rockDark = [55, 65, 81, 255];
    const rockBorder = [31, 41, 55, 255];

    // Forma elíptica de pedra
    const dx = lx - 16;
    const dy = ly - 16;
    const dist = (dx * dx) / (13 * 13) + (dy * dy) / (12 * 12);
    if (dist > 1.0) return bg;
    if (dist > 0.85) return rockBorder;
    if (dx < -3 && dy < -3) return rockLight;
    if (dx > 3 || dy > 3) return rockDark;
    return rockMid;
  }

  // TILE 7 (col 2, row 1): Cerca de madeira (Colisão)
  if (col === 2 && row === 1) {
    const cWood = [146, 64, 14, 255];
    const cWoodDark = [90, 38, 8, 255];
    const cWoodLight = [180, 83, 9, 255];

    // Postes verticais
    if ((lx >= 4 && lx <= 8) || (lx >= 24 && lx <= 28)) {
      if (ly >= 8 && ly <= 28) {
        if (lx === 4 || lx === 24) return cWoodDark;
        if (lx === 8 || lx === 28) return cWoodLight;
        return cWood;
      }
    }
    // Barras horizontais
    if ((ly >= 12 && ly <= 15) || (ly >= 22 && ly <= 25)) {
      if (lx >= 0 && lx <= 31) {
        if (ly === 12 || ly === 22) return cWoodLight;
        if (ly === 15 || ly === 25) return cWoodDark;
        return cWood;
      }
    }
    return [0, 0, 0, 0]; // Transparente no restante da cerca
  }

  // TILE 8 (col 3, row 1): Parede de tijolos / casa (Colisão)
  if (col === 3 && row === 1) {
    const brickRed = [185, 28, 28, 255];
    const brickDark = [127, 29, 29, 255];
    const brickLight = [220, 38, 38, 255];
    const mortar = [226, 232, 240, 255];

    if (ly === 0 || ly === 8 || ly === 16 || ly === 24 || ly === 31) return mortar;
    const rowIdx = Math.floor(ly / 8);
    const offset = rowIdx % 2 === 0 ? 0 : 8;
    if ((lx + offset) % 16 === 0) return mortar;
    if (ly % 8 === 1) return brickLight;
    if (ly % 8 === 7) return brickDark;
    return brickRed;
  }

  return [0, 0, 0, 0];
}

const assetsDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Gera player.png
const playerPng = createPNG(SHEET_W, SHEET_H, getPlayerPixel);
fs.writeFileSync(path.join(assetsDir, 'player.png'), playerPng);
console.log(`[ASSET] player.png gerado (${playerPng.length} bytes)`);

// 2. Gera tileset.png (128x64)
const tilesetPng = createPNG(128, 64, getTilesetPixel);
fs.writeFileSync(path.join(assetsDir, 'tileset.png'), tilesetPng);
console.log(`[ASSET] tileset.png gerado (${tilesetPng.length} bytes)`);
