# Delteria - Multiplayer Top-Down com Phaser 3, Colisão Autoritativa & Chat em Balões

Projeto de jogo multiplayer em tempo real com **Node.js**, **Express**, **Socket.io**, **Phaser 3**, mapas no formato JSON exportados do **Tiled Map Editor** e **sistema de chat global em balões de fala (speech bubbles)**.

---

## 💬 Sistema de Chat Global em Balões (Speech Bubbles)

- **Input Overlay Elegante**:
  - Campo de texto sobreposto na base do canvas do jogo.
  - Ao pressionar **Enter**, o campo é focado automaticamente para digitação.
- **Prevenção de Bugs (WASD Disable)**:
  - Enquanto o input estiver focado, a captura global de teclado do Phaser é desativada temporariamente (`keyboard.enabled = false`), impedindo que o personagem ande acidentalmente ao digitar teclas como WASD.
  - Ao sair do input (ou apertar Enter/Escape), a captura é restaurada suavemente.
- **Envio & Broadcast Autoritativo**:
  - Ao pressionar **Enter** com mensagem preenchida, o evento `chat_message` é enviado via WebSocket para o servidor Node.js.
  - O servidor valida, sanitiza e emite broadcast para todos os clientes conectados (`io.emit('chat_message', { id, message })`).
- **Renderização e Ancoragem no Phaser**:
  - Cada mensagem cria um balão de fala com `Phaser.GameObjects.Text`, tipografia pixelada e fundo escuro translúcido com borda neon.
  - O balão é posicionado acima da cabeça do personagem e sua posição `(X, Y)` é atualizada a cada frame no método `update()`, acompanhando o jogador mesmo se ele estiver andando.
  - Destruição automática com timer de **5 segundos** e transição suave de fade-out.

---

## 🗺️ Mapa Tiled & Sistema de Colisão Autoritativa

- **Formato Tiled Map JSON ([map.json](file:///home/lucasramos/Documentos/graal_navigation_delteria/public/assets/map.json))**:
  - Mapa de 40x30 tiles (1280x960px) com tileset de 32x32px.
  - **Camada `Ground`**: Texturas de terreno (grama, estradas de terra batida e praça central pavimentada com calçamento de pedra).
  - **Camada `Colisao`**: Obstáculos sólidos (muralhas externas de pedra, lago de água profunda, casas de tijolo, fortalezas com portas e cercas de madeira).
- **Feedback Visual Imediato no Cliente (Phaser 3)**:
  - Checagem instantânea de colisão local em tempo real permitindo *wall sliding* (deslizamento suave em paredes sem travamento rígido e sem atraso de rede).
- **Validação Autoritativa no Servidor (Anti-Hack / No Clip Protection)**:
  - O servidor Node.js carrega o mesmo `map.json` na inicialização e inspeciona a camada `Colisao`.
  - A cada movimento, o servidor valida a bounding box do jogador contra os tiles sólidos antes de atualizar a coordenada oficial.

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

### 2. Testar o Chat e Movimentação
1. Abra [http://localhost:3000](http://localhost:3000) em duas abas.
2. Pressione a tecla **Enter** para focar no campo de chat na parte inferior do jogo.
3. Digite sua mensagem (ex: `"E aí, galera!"`) e aperte **Enter**:
   - O balão de fala aparecerá sobre a cabeça do seu personagem em ambas as abas.
   - Mova-se com **WASD**: o balão acompanha o personagem perfeitamente enquanto ele anda.
   - Após **5 segundos**, o balão desaparece automaticamente com fade-out.

### 3. Executar Testes Automatizados
```bash
npm test
```
Valida a comunicação de chat WebSocket, sanitização, leitura do mapa Tiled e colisão autoritativa.
