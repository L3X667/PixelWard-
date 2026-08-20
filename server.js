const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
// Servir les fichiers statiques (index.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.json');

// --- GESTION DE LA BASE DE DONNÉES ---
let db = { users: [], pixels: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('Erreur lecture DB, réinitialisation', e);
    }
} else {
    saveDB();
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sanitizeUser(user) {
    // Optionnel : Forcer le VIP ou des avantages pour des pseudos précis si besoin
    const forceVipUsers = ['L3X', 'Zozo_667'];
    if (forceVipUsers.includes(user.username)) {
        user.isVip = true;
    }

    return {
        username: user.username,
        name: user.username,
        stock: user.stock,
        score: user.score,
        isVip: user.isVip,
        isFounder: user.isFounder,
        hasNeon: user.hasNeon
    };
}

// --- ROUTES API ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    
    let user = db.users.find(u => u.username === username);
    if (user) return res.status(400).json({ error: 'Ce pseudo existe déjà' });

    user = {
        username,
        password,
        stock: 100,
        score: 0,
        isVip: false,
        isFounder: username === 'Admin',
        hasNeon: false
    };
    db.users.push(user);
    saveDB();
    res.json({ user: sanitizeUser(user) });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ error: 'Identifiants incorrects' });
    res.json({ user: sanitizeUser(user) });
});

// Achat définitif (persistance dans la base de données)
app.post('/api/buy-item', (req, res) => {
    const { username, item } = req.body;
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });

    if (item === 'vip') {
        user.isVip = true; 
    } else if (item === 'pixels50') {
        user.stock += 50;
    }

    saveDB();

    // Mise à jour en temps réel si l'utilisateur est connecté
    for (let [id, socket] of io.sockets.sockets) {
        if (socket.userData && socket.userData.username === username) {
            socket.userData = sanitizeUser(user);
            socket.emit('updateStock', { stock: socket.userData.stock });
        }
    }
    res.json({ success: true, user: sanitizeUser(user) });
});

// --- GESTION SOCKET.IO ---
let onlinePlayers = {};

io.on('connection', (socket) => {
    console.log('Utilisateur connecté');

    socket.on('joinGame', (userData) => {
        let dbUser = db.users.find(u => u.username === userData.username);
        if (!dbUser) dbUser = userData;

        socket.userData = sanitizeUser(dbUser);
        onlinePlayers[socket.id] = socket.userData;

        // Envoi de l'état actuel de la carte et du profil mis à jour
        socket.emit('init', {
            pixels: db.pixels,
            user: socket.userData
        });
        io.emit('updatePlayers', onlinePlayers);
    });

    socket.on('placePixel', (data) => {
        if (!socket.userData) return;
        const user = db.users.find(u => u.username === socket.userData.username);
        if (!user) return;

        // Liste des joueurs ayant accès au pixel Rainbow
        const rainbowUsers = ['L3X', 'Zozo_667'];
        const isRainbowUser = rainbowUsers.includes(user.username);

        const isUnlimited = user.isVip || user.isFounder || isRainbowUser;
        if (!isUnlimited && data.color !== null) {
            if (user.stock <= 0) return socket.emit('errorMsg', 'Plus de stock !');
            user.stock--;
        }

        if (data.color === null) {
            delete db.pixels[data.key];
            if (user.score > 0) user.score--;
        } else {
            // Si c'est un joueur autorisé, on enregistre la couleur en mode 'rainbow'
            db.pixels[data.key] = { 
                bounds: data.bounds, 
                color: isRainbowUser ? 'rainbow' : data.color, 
                user: user.username 
            };
            user.score++;
        }

        saveDB();
        socket.userData.stock = user.stock;
        socket.userData.score = user.score;
        onlinePlayers[socket.id] = socket.userData;

        io.emit('pixelPlaced', { key: data.key, bounds: data.bounds, color: db.pixels[data.key]?.color || data.color });
        io.emit('updatePlayers', onlinePlayers);
        socket.emit('updateStock', { stock: user.stock });
    });

    socket.on('disconnect', () => {
        delete onlinePlayers[socket.id];
        io.emit('updatePlayers', onlinePlayers);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur opérationnel sur le port ${PORT}`);
});
