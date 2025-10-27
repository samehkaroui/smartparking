// Netlify Function - API Handler
const express = require('express');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

// Test users
const testUsers = [
  {
    _id: 'admin-001',
    name: 'Administrateur Principal',
    email: 'admin@smartparking.com',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    walletBalance: 0,
    registrationDate: new Date(),
    lastLogin: null,
    totalSessions: 0,
    totalSpent: 0,
    phone: '1234567890',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'operator-001',
    name: 'Opérateur Parking',
    email: 'operator@smartparking.com',
    password: 'operator123',
    role: 'operator',
    status: 'active',
    walletBalance: 0,
    registrationDate: new Date(),
    lastLogin: null,
    totalSessions: 0,
    totalSpent: 0,
    phone: '1122334455',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'customer-001',
    name: 'Client Test',
    email: 'customer@smartparking.com',
    password: 'customer123',
    role: 'customer',
    status: 'active',
    walletBalance: 50.00,
    registrationDate: new Date(),
    lastLogin: null,
    totalSessions: 5,
    totalSpent: 25.50,
    phone: '0987654321',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Netlify Function is running' });
});

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
  }

  const user = testUsers.find(u => u.email === email);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
  }

  const token = Buffer.from(JSON.stringify({
    userId: user._id,
    email: user.email,
    role: user.role,
    name: user.name
  })).toString('base64');

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
      walletBalance: user.walletBalance || 0
    }
  });
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token manquant' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = testUsers.find(u => u._id === decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        name: user.name,
        walletBalance: user.walletBalance || 0
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Token invalide' });
  }
});

// Users
app.get('/api/users', (req, res) => {
  res.json(testUsers);
});

app.get('/api/users/:id', (req, res) => {
  const user = testUsers.find(u => u._id === req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Sessions
app.get('/api/sessions', (req, res) => {
  res.json([]);
});

app.get('/api/sessions/active', (req, res) => {
  res.json([]);
});

app.post('/api/sessions', (req, res) => {
  const sessionId = Date.now().toString();
  res.status(201).json({ _id: sessionId, ...req.body });
});

// Payments
app.get('/api/payments', (req, res) => {
  res.json([]);
});

app.post('/api/payments', (req, res) => {
  const paymentId = Date.now().toString();
  res.status(201).json({ _id: paymentId, ...req.body });
});

app.get('/api/payments/reports', (req, res) => {
  res.json([]);
});

app.get('/api/payments/stats', (req, res) => {
  res.json({ total: 0, count: 0 });
});

// Parking
app.get('/api/parking/spaces', (req, res) => {
  res.json([]);
});

app.post('/api/parking/generate-spaces', (req, res) => {
  const { totalSpaces } = req.body;
  const spaces = [];
  const zones = ['A', 'B', 'C', 'D'];
  const types = ['voiture', 'moto', 'camion'];
  
  for (let i = 1; i <= totalSpaces; i++) {
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const number = `${zone}${String(i).padStart(3, '0')}`;
    
    spaces.push({
      _id: i,
      number,
      zone,
      type,
      vehicleType: type,
      status: 'libre',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  res.json({ 
    success: true, 
    message: `${totalSpaces} places créées`,
    spaces: spaces.length,
    data: spaces
  });
});

app.post('/api/parking/cleanup-expired', (req, res) => {
  res.json({ success: true, message: 'Réservations nettoyées', cleaned: 0 });
});

app.post('/api/parking/reserve', (req, res) => {
  res.json({ success: true, message: 'Space reserved' });
});

app.post('/api/parking/occupy', (req, res) => {
  res.json({ success: true, message: 'Space occupied' });
});

app.post('/api/parking/free', (req, res) => {
  res.json({ success: true, message: 'Space freed' });
});

// Notifications
app.get('/api/notifications', (req, res) => {
  res.json([]);
});

app.get('/api/notifications/unread', (req, res) => {
  res.json([]);
});

// Alerts
app.get('/api/alerts', (req, res) => {
  res.json({ alerts: [] });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json({
    success: true,
    config: {
      totalSpaces: 100,
      baseRate: 2.5,
      dynamicPricing: true
    },
    pricingRules: []
  });
});

app.post('/api/settings', (req, res) => {
  res.json({ success: true, message: 'Settings saved' });
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json({
    spaces: {
      total: 100,
      free: 80,
      occupied: 15,
      reserved: 3,
      outOfService: 2,
      occupancyRate: 15
    },
    sessions: {
      today: 25,
      active: 15
    },
    timestamp: new Date()
  });
});

// Transactions
app.get('/api/transactions', (req, res) => {
  res.json([]);
});

// Export as Netlify Function
module.exports.handler = serverless(app);
