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
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Shadow2563";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "OblivionSecure2025!";
const JWT_SECRET = process.env.JWT_SECRET || "your_secure_secret";

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
const getUsers = () => JSON.parse(fs.readFileSync(USERS_FILE));
const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const getLogs = () => JSON.parse(fs.readFileSync(LOGS_FILE));
const addLog = (action, username, details) => {
    const logs = getLogs();
    logs.push({
        timestamp: new Date().toISOString(),
        action,
        username,
        details
    });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
};

// Middleware to verify admin access
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || authHeader !== `Basic ${Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64')}`) {
        addLog('unauthorized_access_attempt', req.ip, { endpoint: req.originalUrl });
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Main Application Routes //

// User signup
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    const users = getUsers();

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
        return res.status(400).json({
            error: 'Username must contain only lowercase letters, numbers, and underscores'
        });
    }

    // Validate password strength
    if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/.test(password)) {
        return res.status(400).json({
            error: 'Password must be 8+ characters with uppercase, number, and special character'
        });
    }

    // Check if user exists
    if (users.some(u => u.username === username || u.email === email)) {
        return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add new user
    const newUser = {
        username,
        email,
        password: hashedPassword,
        coins: 100, // Starting coins
        status: 'disconnected',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        botConnected: false
    };

    users.push(newUser);
    saveUsers(users);
    addLog('user_signup', username, { email });

    res.json({ success: true, user: { username, email } });
});

// User login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    const user = users.find(u => 
        u.username === username || u.email === username
    );

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update user status
    user.status = 'connected';
    user.lastActive = new Date().toISOString();
    saveUsers(users);
    addLog('user_login', user.username, { status: 'connected' });
    
    res.json({ 
        success: true, 
        user: {
            username: user.username,
            email: user.email,
            coins: user.coins
        }
    });
});

// Admin Routes //

// Admin login
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        addLog('admin_login', username, { success: true });
        res.json({ 
            success: true,
            token: Buffer.from(`${username}:${password}`).toString('base64')
        });
    } else {
        addLog('admin_login_failed', username, { success: false });
        res.status(401).json({ error: 'Invalid admin credentials' });
    }
});

// Get all users (admin only)
app.get('/admin/users', verifyAdmin, (req, res) => {
    const users = getUsers().map(user => ({
        username: user.username,
        email: user.email,
        status: user.status,
        coins: user.coins,
        lastActive: user.lastActive,
        createdAt: user.createdAt,
        botConnected: user.botConnected
    }));
    res.json(users);
});

// Get stats (admin only)
app.get('/admin/stats', verifyAdmin, (req, res) => {
    const users = getUsers();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const stats = {
        totalUsers: users.length,
        activeToday: users.filter(u => u.lastActive >= today && u.status === 'connected').length,
        totalCoins: users.reduce((sum, user) => sum + user.coins, 0),
        botConnections: users.filter(u => u.botConnected).length,
        newUsersToday: users.filter(u => u.createdAt >= today).length
    };

    res.json(stats);
});

// Update user coins (admin only)
app.post('/admin/update-coins', verifyAdmin, (req, res) => {
    const { username, coins, operation } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (operation === 'add') {
        user.coins += parseInt(coins) || 0;
    } else if (operation === 'set') {
        user.coins = parseInt(coins) || 0;
    } else if (operation === 'subtract') {
        user.coins -= parseInt(coins) || 0;
    }

    user.coins = Math.max(0, user.coins); // Prevent negative coins
    saveUsers(users);
    
    addLog('coin_update', 'admin', { 
        targetUser: username, 
        operation, 
        amount: coins,
        newBalance: user.coins 
    });

    res.json({ 
        success: true, 
        coins: user.coins,
        username: user.username
    });
});

// Update bot connection status
app.post('/admin/update-bot-status', verifyAdmin, (req, res) => {
    const { username, connected } = req.body;
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
    
    addLog('bot_status_update', 'admin', { 
        targetUser: username, 
        status: connected ? 'connected' : 'disconnected' 
    });

    res.json({ success: true, botConnected: user.botConnected });
});

// Get admin logs
app.get('/admin/logs', verifyAdmin, (req, res) => {
    const logs = getLogs();
    res.json(logs);
});

// Search users (admin only)
app.get('/admin/search', verifyAdmin, (req, res) => {
    const query = (req.query.q || '').toLowerCase();
    const users = getUsers();

    const results = users
        .filter(user => 
            user.username.toLowerCase().includes(query) || 
            user.email.toLowerCase().includes(query)
        )
        .map(user => ({
            username: user.username,
            email: user.email,
            status: user.status,
            coins: user.coins,
            lastActive: user.lastActive,
            botConnected: user.botConnected
        }));

    res.json(results);
});

// Start server
app.listen(PORT, () => {
    console.log(`Oblivion server active on port ${PORT}`);
    console.log(`Admin username: ${ADMIN_USERNAME}`);
});
