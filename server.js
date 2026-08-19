const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

const users = {};
const players = {};
const bannedUsers = new Set();

// Chargement / Sauvegarde des pixels
let pixels = {};
if (fs.existsSync('pixels.json')) {
  try {
    pixels = JSON.parse(fs.readFileSync('pixels.json', 'utf8'));
  } catch (e) {
    console.error('Erreur chargement pixels:', e);
  }
}

function savePixels() {
  fs.writeFile('pixels.json', JSON.stringify(pixels), () => {});
}

// Compte Fondateur
users['l3x'] = {
  password: 'Zozo_667',
  isVip: false,
  isFounder: true,
  hasNeon: false,
  hasBrush: false,
  shields: 0,
  stock: 999999
};

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
  if (users[username]) return res.status(400).json({ error: 'Pseudo déjà pris' });

  users[username] = { 
    password, 
    isVip: false, 
    isFounder: false, 
    hasNeon: false, 
    hasBrush: false, 
    shields: 0, 
    stock: 10 
  };
  res.json({ user: { username, isVip: false, isFounder: false, hasNeon: false, hasBrush: false, shields: 0, stock: 10 } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (bannedUsers.has(username)) return res.status(403).json({ error: 'Vous êtes banni de PixelWar.' });

  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'Identifiants incorrects' });
  }

  res.json({
    user: {
      username,
      isVip: user.isVip,
      isFounder: user.isFounder,
      hasNeon: user.hasNeon,
      hasBrush: user.hasBrush || false,
      shields: user.shields || 0,
      stock: user.stock || 10
    }
  });
});

// Route d'achat boutique complète
app.post('/api/buy-item', (req, res) => {
  const { username, item } = req.body;
  const user = users[username];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  if (item === 'vip') {
    user.isVip = true;
  } else if (item === 'pixels50') {
    user.stock = (user.stock || 0) + 50;
  } else if (item === 'neon') {
    user.hasNeon = true;
  } else if (item === 'brush') {
    user.hasBrush = true;
  } else if (item === 'shield') {
    user.shields = (user.shields || 0) + 1;
  }

  res.json({ success: true, user });
});

io.on('connection', (socket) => {
  socket.on('joinGame', (user) => {
    if (bannedUsers.has(user.username)) {
      socket.emit('errorMsg', 'Vous êtes banni.');
      socket.disconnect();
      return;
    }

    // Supprimer les anciennes connexions du même utilisateur (évite les doublons/triples)
    for (const [id, p] of Object.entries(players)) {
      if (p.name === user.username) {
        delete players[id];
      }
    }

    const userData = users[user.username] || user;
    players[socket.id] = {
      name: user.username,
      score: 0,
      isVip: userData.isVip,
      isFounder: userData.isFounder,
      hasNeon: userData.hasNeon
    };

    socket.emit('init', { pixels });
    io.emit('updatePlayers', players);
  });

  socket.on('placePixel', (data) => {
    const player = players[socket.id];
    if (!player) return;

    const dbUser = users[player.name];
    
    // Décompte si pas VIP / Fondateur
    if (!player.isVip && !player.isFounder) {
      if (!dbUser || dbUser.stock <= 0) {
        socket.emit('errorMsg', 'Plus de pixels disponibles ! Passe au shop.');
        return;
      }
      dbUser.stock -= 1;
      socket.emit('updateStock', { stock: dbUser.stock });
    }

    pixels[data.key] = { bounds: data.bounds, color: data.color };
    player.score += 1;
    savePixels();

    io.emit('pixelPlaced', data);
    io.emit('updatePlayers', players);
  });

  socket.on('adminAction', ({ action, targetUsername }) => {
    const sender = players[socket.id];
    if (!sender || !sender.isFounder) return;

    if (action === 'ban') {
      bannedUsers.add(targetUsername);
      for (const [id, p] of Object.entries(players)) {
        if (p.name === targetUsername) {
          io.sockets.sockets.get(id)?.disconnect();
          delete players[id];
        }
      }
      io.emit('updatePlayers', players);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

server.listen(3000, () => {
  console.log('Serveur prêt sur http://localhost:3000');
});
