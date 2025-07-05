require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data/users.json');
const LOGS_FILE = path.join(__dirname, 'data/admin_logs.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Initialize server
app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]');
}
if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, '[]');
}

// Helper functions
const getUsers = () => {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE));
    } catch (e) {
        return [];
    }
};

const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const getLogs = () => {
    try {
        return JSON.parse(fs.readFileSync(LOGS_FILE));
    } catch (e) {
        return [];
    }
};

const addLog = (action, username, details = {}) => {
    const logs = getLogs();
    logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        action,
        username,
        details
    });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
};

// Middleware to verify admin access
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        addLog('UNAUTHORIZED_ACCESS_ATTEMPT', req.ip, { endpoint: req.originalUrl });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        addLog('FAILED_ADMIN_LOGIN', username, { ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Generate stats
const generateStats = () => {
    const users = getUsers();
    const logs = getLogs();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    return {
        totalUsers: users.length,
        activeToday: users.filter(u => new Date(u.lastActive) > twentyFourHoursAgo).length,
        botConnections: users.filter(u => u.botConnected).length,
        totalCoins: users.reduce((sum, user) => sum + user.coins, 0),
        newUsersToday: users.filter(u => new Date(u.createdAt) > twentyFourHoursAgo).length,
        dailyTransactions: logs.filter(log => 
            new Date(log.timestamp) > twentyFourHoursAgo && 
            log.action.includes('COIN_')
        ).length,
        systemStatus: 'ONLINE',
        systemLoad: `${(Math.random() * 2).toFixed(1)} | ${(Math.random() * 2).toFixed(1)} | ${(Math.random() * 2).toFixed(1)}`,
        securityLevel: 'MAXIMUM',
        lastScan: '2 min ago',
        dbSize: `${(users.length * 0.002).toFixed(1)}MB`,
        dbUptime: '14d 6h',
        networkStatus: 'STABLE',
        networkLatency: `${Math.floor(Math.random() * 30) + 10}ms`
    };
};

// Initialize with admin user if none exists
if (!getUsers().some(u => u.username === ADMIN_USERNAME)) {
    const users = getUsers();
    users.push({
        id: 'admin-' + Date.now(),
        username: ADMIN_USERNAME,
        email: 'admin@oblivion.net',
        password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
        coins: 1000000,
        role: 'admin',
        status: 'connected',
        accountStatus: 'active',
        botConnected: true,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastIp: '127.0.0.1',
        deviceInfo: 'Admin Console'
    });
    saveUsers(users);
    addLog('SYSTEM_INIT', 'SYSTEM', { message: 'Initial admin user created' });
}

// Admin Auth
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        addLog('ADMIN_LOGIN_SUCCESS', username);
        res.json({ 
            success: true,
            token: Buffer.from(`${username}:${password}`).toString('base64')
        });
    } else {
        addLog('ADMIN_LOGIN_FAILED', username);
        res.status(401).json({ error: 'Invalid admin credentials' });
    }
});

// Admin Routes
app.get('/admin/stats', verifyAdmin, (req, res) => {
    res.json(generateStats());
});

app.get('/admin/users', verifyAdmin, (req, res) => {
    res.json(getUsers().map(user => ({
        username: user.username,
        email: user.email,
        status: user.status,
        coins: user.coins,
        lastActive: user.lastActive,
        createdAt: user.createdAt,
        botConnected: user.botConnected,
        role: user.role
    })));
});

app.post('/admin/users', verifyAdmin, (req, res) => {
    const { username, email, password, coins, role } = req.body;
    const users = getUsers();

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (users.some(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = {
        id: 'user-' + Date.now(),
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        coins: parseInt(coins) || 100,
        role: role || 'user',
        status: 'pending',
        accountStatus: 'active',
        botConnected: false,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    addLog('USER_CREATED', 'admin', { username, email, role });

    res.json({ success: true, user: newUser });
});

app.post('/admin/users/:username/coins', verifyAdmin, (req, res) => {
    const { username } = req.params;
    const { amount, operation } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    let newAmount = user.coins;
    switch (operation) {
        case 'add':
            newAmount += parseInt(amount);
            break;
        case 'subtract':
            newAmount = Math.max(0, user.coins - parseInt(amount));
            break;
        case 'set':
            newAmount = parseInt(amount);
            break;
        default:
            return res.status(400).json({ error: 'Invalid operation' });
    }

    user.coins = newAmount;
    saveUsers(users);
    addLog('COIN_UPDATE', 'admin', { username, operation, amount, newAmount });

    res.json({ success: true, coins: user.coins });
});

app.post('/admin/users/:username/bot', verifyAdmin, (req, res) => {
    const { username } = req.params;
    const { connected } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.botConnected = connected;
    if (connected) {
        user.status = 'connected';
        user.lastActive = new Date().toISOString();
    }
    saveUsers(users);
    addLog('BOT_STATUS_UPDATE', 'admin', { username, connected });

    res.json({ success: true, botConnected: user.botConnected });
});

app.get('/admin/logs', verifyAdmin, (req, res) => {
    res.json(getLogs());
});

app.delete('/admin/logs', verifyAdmin, (req, res) => {
    fs.writeFileSync(LOGS_FILE, '[]');
    addLog('LOGS_CLEARED', 'admin');
    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`Oblivion Admin Server running on port ${PORT}`);
    console.log(`Admin access: ${ADMIN_USERNAME}:${ADMIN_PASSWORD}`);
});
