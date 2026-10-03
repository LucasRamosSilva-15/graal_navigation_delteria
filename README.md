# Delteria - Protótipo Multiplayer com Canvas & WebSocket Sync

Projeto de jogo multiplayer em tempo real com controle de estado no servidor, movimentação com teclas WASD/Setas e renderização em Canvas HTML5.

---

## 🕹️ Novas Funcionalidades Implementadas

- **Estado de Posição no Servidor**: Cada jogador possui uma posição `x`, `y`, tamanho e uma cor distinta gerada dinamicamente.
- **Captura de Teclas Contínua**: Teclas **WASD** ou **Setas do Teclado** (`▲ ◄ ▼ ►`) capturadas com suporte a movimento diagonal suave e prevenção de scroll da página.
- **Sincronização em Tempo Real (Zero Lag)**: Envio a 60Hz e broadcast imediato via `player_moved` para todos os clientes conectados.
- **Renderização via Canvas API Nativa**: Renderização fluida com `requestAnimationFrame` exibindo os quadrados coloridos dos jogadores, identificação "VOCÊ" com glow ciano e tags dos outros jogadores.
- **Medidor de FPS e Coordenadas**: Exibição em tempo real das coordenadas `(X, Y)` e da taxa de quadros (FPS).

---

## 🚀 Como Executar

### 1. Iniciar o servidor
```bash
npm start
# ou com auto-reload:
npm run dev
```

Abra no navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

### 2. Testar Sincronização Multiplayer
1. Abra duas abas no navegador em [http://localhost:3000](http://localhost:3000).
2. Na primeira aba, mova seu quadrado usando **WASD** ou as **Setas**.
3. Observe a segunda aba: o quadrado correspondente se move instantaneamente sem atraso!
4. Abra o Console do Desenvolvedor (**F12**) para inspecionar os logs de conexão e eventos.

### 3. Rodar Testes Automatizados
```bash
npm test
```
