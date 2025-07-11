require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20
});

// Bot state management
const activeBots = new Map();

// Mock database
let users = [
  {
    id: 1,
    username: "Shadow",
    email: "admin@oblivion.com",
    password: bcrypt.hashSync("Shadow", 10),
    role: "admin"
  }
];

// Password reset tokens
const resetTokens = new Map();

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper functions
const generateToken = () => crypto.randomBytes(32).toString('hex');
const generatePairingCode = () => Math.floor(100000 + Math.random() * 900000);

// Bot Control Routes
app.post('/api/start', authLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    
    // Check if bot is already running for this number
    if (activeBots.has(phoneNumber)) {
      return res.status(400).json({ error: "Bot already running for this number" });
    }
    
    // Generate pairing code
    const pairingCode = generatePairingCode();
    
    // Simulate bot starting (replace with your actual bot start logic)
    activeBots.set(phoneNumber, {
      status: 'running',
      pairingCode,
      startedAt: new Date()
    });
    
    console.log(`Started bot for ${phoneNumber} with code ${pairingCode}`);
    
    res.json({ 
      success: true,
      pairingCode,
      message: "Bot started successfully"
    });
    
  } catch (error) {
    console.error("Error starting bot:", error);
    res.status(500).json({ error: "Failed to start bot" });
  }
});

app.post('/api/stop', authLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Clean the phone number to use in file path
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const sessionPath = path.join(__dirname, 'lib2', 'pairing', cleanNumber);

    // Check if bot is active in memory
    const wasActiveInMemory = activeBots.has(phoneNumber);
    
    // Check if session file exists
    const sessionExists = fs.existsSync(sessionPath);

    if (!wasActiveInMemory && !sessionExists) {
      return res.status(404).json({ 
        success: false,
        error: "No active bot session found for this number"
      });
    }

    // 1. Remove from active bots map
    if (wasActiveInMemory) {
      activeBots.delete(phoneNumber);
    }

    // 2. Delete session file if exists
    if (sessionExists) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`Deleted session file for ${phoneNumber}`);
    }

    // 3. Add your actual bot shutdown logic here
    // Example: await botInstance.shutdown();

    console.log(`Stopped bot and cleaned session for: ${phoneNumber}`);
    
    res.json({ 
      success: true,
      message: `Bot stopped successfully for ${phoneNumber}`,
      details: {
        memoryCleaned: wasActiveInMemory,
        sessionDeleted: sessionExists
      }
    });
    
  } catch (error) {
    console.error("Error stopping bot:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to stop bot",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/add', authLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    
    // In a real implementation, you would add this to a queue or database
    console.log(`Added number to pairing queue: ${phoneNumber}`);
    
    res.json({ 
      success: true,
      message: "Number added to queue"
    });
    
  } catch (error) {
    console.error("Error adding number:", error);
    res.status(500).json({ error: "Failed to add number" });
  }
});

// Serve HTML files
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Auth Routes
app.post('/api/login', authLimiter, async (req, res) => {
  const { identifier, password } = req.body;
  
  // Special admin login
  if (identifier.toLowerCase() === "shadow" && password === "Shadow") {
    const token = jwt.sign(
      { userId: 1, role: "admin" },
      process.env.ADMIN_SECRET || 'ADMIN_SECRET_KEY',
      { expiresIn: '1h' }
    );
    return res.json({ token, role: "admin" });
  }

  // Normal login
  const user = users.find(u => 
    u.email === identifier || u.username === identifier
  );
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.USER_SECRET || 'USER_SECRET_KEY',
    { expiresIn: '1h' }
  );
  
  res.json({ token, role: user.role });
});

app.post('/api/signup', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  
  if (users.some(u => u.email === email)) {
    return res.status(400).json({ field: "email", error: "Email already in use" });
  }
  
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ field: "username", error: "Username taken" });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    username,
    email,
    password: hashedPassword,
    role: "user"
  };
  
  users.push(newUser);
  
  const token = jwt.sign(
    { userId: newUser.id, role: newUser.role },
    process.env.USER_SECRET || 'USER_SECRET_KEY',
    { expiresIn: '1h' }
  );
  
  // Return token and user data
  res.status(201).json({ 
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// Password Reset Routes
app.post('/api/password/reset-request', authLimiter, async (req, res) => {
  const { identifier } = req.body;
  const user = users.find(u => 
    u.email === identifier || u.username === identifier
  );
  
  if (!user) {
    // Don't reveal whether identifier exists
    return res.json({ message: "If an account exists, a reset link has been sent" });
  }
  
  const token = generateToken();
  resetTokens.set(token, {
    userId: user.id,
    expires: Date.now() + 3600000 // 1 hour
  });
  
  const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  console.log(`Password reset link for ${user.email}: ${resetLink}`);
  
  try {
    await transporter.sendMail({
      from: '"Oblivion Bot" <noreply@oblivion.com>',
      to: user.email,
      subject: 'Password Reset Request',
      html: `Click <a href="${resetLink}">here</a> to reset your password`
    });
  } catch (err) {
    console.error("Email error:", err);
  }
  
  res.json({ message: "If an account exists, a reset link has been sent" });
});

app.post('/api/password/reset', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  const resetData = resetTokens.get(token);
  
  if (!resetData || resetData.expires < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
  
  const user = users.find(u => u.id === resetData.userId);
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }
  
  // Update password
  user.password = await bcrypt.hash(newPassword, 10);
  resetTokens.delete(token);
  
  res.json({ message: "Password updated successfully" });
});

// Admin Routes
app.get('/api/admin/stats', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET || 'ADMIN_SECRET_KEY');
    if (decoded.role !== 'admin') return res.sendStatus(403);
    
    res.json({
      totalUsers: users.length,
      activeBots: activeBots.size,
      totalCommands: 10243,
      systemStatus: "Operational",
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Oblivion API running on port ${PORT}`);
  console.log(`Admin login: Username="Shadow", Password="Shadow"`);
});
