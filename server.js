const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const DB_FILE = path.join(__dirname, 'database.json');

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
    // Forcer les privilèges pour L3X et Zozo_667
    const founders = ['L3X', 'Admin'];
    const rainbowUsers = ['L3X', 'Zozo_667'];

    if (founders.includes(user.username)) {
        user.isFounder = true;
        user.isVip = true;
    }
    if (rainbowUsers.includes(user.username)) {
        user.hasRainbow = true;
    }

    return {
        username: user.username,
        name: user.username,
        stock: user.stock,
        score: user.score,
        isVip: user.isVip,
        isFounder: user.isFounder,
        hasNeon: user.hasNeon,
        hasRainbow: user.hasRainbow
    };
}

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
        isFounder: username === 'L3X' || username === 'Admin',
        hasNeon: false,
        hasRainbow: username === 'L3X' || username === 'Zozo_667'
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

    for (let [id, socket] of io.sockets.sockets) {
        if (socket.userData && socket.userData.username === username) {
            socket.userData = sanitizeUser(user);
            socket.emit('updateStock', { stock: socket.userData.stock });
        }
    }
    res.json({ success: true, user: sanitizeUser(user) });
});

let onlinePlayers = {};

io.on('connection', (socket) => {
    console.log('Utilisateur connecté');

    socket.on('joinGame', (userData) => {
        let dbUser = db.users.find(u => u.username === userData.username);
        if (!dbUser) dbUser = userData;

        socket.userData = sanitizeUser(dbUser);
        onlinePlayers[socket.id] = socket.userData;

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

        const isRainbowUser = user.username === 'L3X' || user.username === 'Zozo_667';
        const isUnlimited = user.isVip || user.isFounder || isRainbowUser;

        if (!isUnlimited && data.color !== null) {
            if (user.stock <= 0) return socket.emit('errorMsg', 'Plus de stock !');
            user.stock--;
        }

        if (data.color === null) {
            delete db.pixels[data.key];
            if (user.score > 0) user.score--;
        } else {
            db.pixels[data.key] = { 
                bounds: data.bounds, 
                color: data.color, 
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
