const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(__dirname));

let users = {}; 
let pixels = {}; 

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Remplis tous les champs.' });
  }
  if (users[username]) {
    return res.status(400).json({ error: 'Ce pseudo est déjà pris.' });
  }

  users[username] = {
    name: username,
    password: password,
    stock: 100, 
    isVip: false,
    isFounder: username.toLowerCase() === 'l3x', 
    hasNeon: false,
    score: 0
  };

  res.json({ success: true, user: users[username] });
});

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

io.on('connection', (socket) => {
  let currentUser = null;
  let rechargeInterval = null;

  socket.on('joinGame', (userData) => {
    currentUser = users[userData.name] || userData;
    users[currentUser.name] = currentUser;

    socket.emit('init', { pixels, players: users });
    io.emit('updatePlayers', users);

    // Recharge automatique : +1 pixel toutes les 5 secondes (pour les non-VIP / non-Fondateurs)
    rechargeInterval = setInterval(() => {
      if (currentUser && !currentUser.isVip && !currentUser.isFounder) {
        currentUser.stock += 1;
        socket.emit('updateStock', { stock: currentUser.stock });
      }
    }, 5000); // 5000 millisecondes = 5 secondes
  });

  socket.on('placePixel', (data) => {
    if (!currentUser) return;

    if (!currentUser.isVip && !currentUser.isFounder) {
      if (currentUser.stock <= 0) {
        socket.emit('errorMsg', "Tu n'as plus de pixels en stock ! Attends un peu.");
        return;
      }
      currentUser.stock -= 1;
      socket.emit('updateStock', { stock: currentUser.stock });
    }

    pixels[data.key] = { bounds: data.bounds, color: data.color, user: currentUser.name };
    currentUser.score += 1;

    io.emit('pixelPlaced', { key: data.key, bounds: data.bounds, color: data.color });
    io.emit('updatePlayers', users);
  });

  socket.on('adminAction', (data) => {
    if (currentUser && currentUser.isFounder && data.action === 'ban') {
      delete users[data.targetUsername];
      io.emit('updatePlayers', users);
    }
  });

  socket.on('disconnect', () => {
    if (rechargeInterval) {
      clearInterval(rechargeInterval); // Stoppe le minuteur si le joueur quitte la page
    }
    if (currentUser) {
      io.emit('updatePlayers', users);
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
