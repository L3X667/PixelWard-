const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir les fichiers statiques (HTML, CSS, JS du client)
app.use(express.static(__dirname));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Gestion des connexions en temps réel
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté :', socket.id);

  // Exemple : réception d'un pseudo lors de la connexion
  socket.on('user-login', (pseudo) => {
    console.log(`Utilisateur enregistré : ${pseudo} (${socket.id})`);
    // Tu pourras diffuser l'information aux autres joueurs ici
  });

  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté :', socket.id);
  });
});

// Port dynamique pour Render ou 3000 par défaut en local
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
