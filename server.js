const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

// Base de données en mémoire (utilisateurs et pixels)
let users = {}; // ex: { "pseudo": { name, password, stock, isVip, isFounder, hasNeon, score } }
let pixels = {}; // ex: { "lat,lng": { bounds, color, user } }

// Route d'inscription
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Remplis tous les champs.' });
  }
  if (users[username]) {
    return res.status(400).json({ error: 'Ce pseudo est déjà pris.' });
  }

  // Création du compte (Le premier inscrit peut être fondateur si tu veux, ou géré ici)
  users[username] = {
    name: username,
    password: password,
    stock: 100, // Pixels de départ
    isVip: false,
    isFounder: username === 'L3X', // Exemple : si tu t'appelles L3X tu es fondateur
    hasNeon: false,
    score: 0
  };

  res.json({ success: true, user: users[username] });
});

// Route de connexion
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Remplis tous les champs.' });
  }
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'Pseudo ou mot de passe incorrect.' });
  }

  res.json({ success: true, user });
});

// Route pour les achats de la boutique (Bouton PayPal)
app.post('/api/buy-item', (req, res) => {
  const { username, item } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Utilisateur introuvable.' });

  if (item === 'vip') {
    user.isVip = true;
  } else if (item === 'pixels50') {
    user.stock += 50;
  } else if (item === 'neon') {
    user.hasNeon = true;
  } else if (item === 'brush') {
    user.hasBrush = true;
  } else if (item === 'shield') {
    user.hasShield = true;
  }

  res.json({ success: true, user });
});

// Gestion des connexions en temps réel avec Socket.io
io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('joinGame', (userData) => {
    currentUser = userData;
    users[currentUser.name] = currentUser;

    // Envoi de l'état initial de la carte au joueur
    socket.emit('init', { pixels, players: users });

    // Diffuse la liste mise à jour des joueurs connectés
    io.emit('updatePlayers', users);
  });

  // Quand un joueur place un pixel sur la carte
  socket.on('placePixel', (data) => {
    if (!currentUser) return;

    // Vérification du stock (sauf si VIP ou Fondateur)
    if (!currentUser.isVip && !currentUser.isFounder) {
      if (currentUser.stock <= 0) {
        socket.emit('errorMsg', "Tu n'as plus de pixels en stock !");
        return;
      }
      currentUser.stock -= 1;
      socket.emit('updateStock', { stock: currentUser.stock });
    }

    // Enregistrement et diffusion du pixel
    pixels[data.key] = { bounds: data.bounds, color: data.color, user: currentUser.name };
    currentUser.score += 1;

    io.emit('pixelPlaced', { key: data.key, bounds: data.bounds, color: data.color });
    io.emit('updatePlayers', users);
  });

  // Actions administrateur (Bannissement par le fondateur)
  socket.on('adminAction', (data) => {
    if (currentUser && currentUser.isFounder && data.action === 'ban') {
      delete users[data.targetUsername];
      io.emit('updatePlayers', users);
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      // Optionnel : tu peux gérer la déconnexion ici si besoin
      io.emit('updatePlayers', users);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
