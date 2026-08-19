const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Grille de pixels (par exemple 20x20 initialisée en blanc #FFFFFF)
const GRID_SIZE = 20;
let pixelGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('#FFFFFF'));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté :', socket.id);

  // Envoi de la grille actuelle au nouveau joueur
  socket.emit('init-grid', pixelGrid);

  // Quand un joueur clique sur un pixel
  socket.on('place-pixel', ({ x, y, color }) => {
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      pixelGrid[x][y] = color;
      // Diffuse le changement à TOUS les joueurs connectés en temps réel
      io.emit('update-pixel', { x, y, color });
    }
  });

  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté :', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
