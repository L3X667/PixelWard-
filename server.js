const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Permet de servir les fichiers statiques (ton index.html, CSS, etc.)
app.use(express.static(__dirname));

// Route principale explicite pour charger index.html
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Gestion des connexions Socket.io (pour ton jeu Pixel War)
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté :', socket.id);

  // Tu peux rajouter tes événements de jeu ici (ex: pose de pixel)
  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté :', socket.id);
  });
});

// Utilisation du port dynamique de Render, ou 3000 par défaut en local
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
