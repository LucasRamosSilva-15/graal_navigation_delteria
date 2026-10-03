# Delteria - Multiplayer Top-Down com Phaser 3 & Colisão Autoritativa Tiled

Projeto de jogo multiplayer em tempo real com **Node.js**, **Express**, **Socket.io**, **Phaser 3** e mapas no formato JSON exportados do **Tiled Map Editor**.

---

## 🗺️ Mapa Tiled & Sistema de Colisão Autoritativa

- **Formato Tiled Map JSON ([map.json](file:///home/lucasramos/Documentos/graal_navigation_delteria/public/assets/map.json))**:
  - Mapa de 40x30 tiles (1280x960px) com tileset de 32x32px.
  - **Camada `Ground`**: Texturas de terreno (grama, estradas de terra batida e praça central pavimentada com calçamento de pedra).
  - **Camada `Colisao`**: Obstáculos sólidos (muralhas externas de pedra, lago de água profunda, casas de tijolo, fortalezas com portas e cercas de madeira).
- **Feedback Visual Imediato no Cliente (Phaser 3)**:
  - O cliente carrega o mapa com `make.tilemap` e aplica `setCollisionByExclusion([-1, 0])` na camada `Colisao`.
  - Checagem instantânea de colisão local em tempo real permitindo *wall sliding* (deslizamento suave em paredes sem travamento rígido e sem atraso de latência de rede).
- **Validação Autoritativa no Servidor (Anti-Hack / No Clip Protection)**:
  - O servidor Node.js carrega o mesmo `map.json` na inicialização e inspeciona o array de tiles da camada `Colisao`.
  - A cada evento de movimento recebido, o servidor valida a bounding box do jogador contra os tiles sólidos antes de atualizar a coordenada oficial.
  - Tentativas de atravessar paredes ou modificar coordenadas no cliente são bloqueadas imediatamente pelo servidor.

---

## 🚀 Como Executar

### 1. Iniciar o servidor
```bash
npm start
# ou no modo de desenvolvimento:
npm run dev
```

Abra no navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

*(Caso a porta 3000 esteja retida por algum processo anterior: `lsof -t -i:3000 | xargs -r kill -9`)*

### 2. Testar Colisão e Multiplayer
1. Abra [http://localhost:3000](http://localhost:3000).
2. Ande com **WASD** ou as **Setas do Teclado** em direção a:
   - As paredes externas de pedra.
   - O lago de água no canto superior direito.
   - A casa de tijolos (tente entrar pela porta aberta e depois andar contra a parede de dentro).
3. Observe que o herói colide de forma natural com feedback visual imediato e sem atravessar obstáculos.
4. Abra uma segunda aba para observar a movimentação e sincronização com os outros jogadores no cenário.

### 3. Executar Testes Automatizados
```bash
npm test
```
Valida a leitura do `map.json`, a camada de colisão e a rejeição autoritativa de tentativas de atravessar paredes no servidor.
