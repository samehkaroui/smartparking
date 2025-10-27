// Netlify Function - Complete API Handler (mirrors server-simple.js)
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
    walletBalance: 0
  },
  {
    _id: 'operator-001',
    name: 'Opérateur Parking',
    email: 'operator@smartparking.com',
    password: 'operator123',
    role: 'operator',
    status: 'active',
    walletBalance: 0
  },
  {
    _id: 'customer-001',
    name: 'Client Test',
    email: 'customer@smartparking.com',
    password: 'customer123',
    role: 'customer',
    status: 'active',
    walletBalance: 50.00
  }
];

// ==================== AUTH ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    console.log('Available users:', testUsers.map(u => u.email));

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }

    const user = testUsers.find(u => u.email === email);
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user || user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
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
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token manquant' 
      });
    }

    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = testUsers.find(u => u._id === decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        name: user.name,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: 'Token invalide' 
    });
  }
});

// ==================== HEALTH ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Netlify Function is running' });
});

// ==================== SESSIONS ====================

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

app.put('/api/sessions/:id', (req, res) => {
  res.json({ success: true, message: 'Session updated' });
});

app.put('/api/sessions/:id/end', (req, res) => {
  res.json({ success: true, message: 'Session ended' });
});

app.post('/api/sessions/:id/pay', (req, res) => {
  res.json({ success: true, message: 'Payment processed' });
});

// ==================== PAYMENTS ====================

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

// ==================== PARKING ====================

app.get('/api/parking/spaces', (req, res) => {
  res.json([]);
});

app.get('/api/parking/spaces/:number', (req, res) => {
  res.json({ 
    number: req.params.number, 
    status: 'libre',
    zone: 'A',
    type: 'voiture'
  });
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
  res.json({ 
    success: true, 
    message: 'Réservations expirées nettoyées',
    cleaned: 0
  });
});

// ==================== NOTIFICATIONS ====================

app.get('/api/notifications', (req, res) => {
  res.json([]);
});

app.post('/api/notifications', (req, res) => {
  const notificationId = Date.now().toString();
  res.status(201).json({ _id: notificationId, ...req.body });
});

app.get('/api/notifications/unread', (req, res) => {
  res.json([]);
});

app.patch('/api/notifications/:id/read', (req, res) => {
  res.json({ success: true, message: 'Notification marked as read' });
});

app.delete('/api/notifications/:id', (req, res) => {
  res.json({ success: true, message: 'Notification deleted' });
});

// ==================== ALERTS ====================

app.get('/api/alerts', (req, res) => {
  res.json({ alerts: [] });
});

app.post('/api/alerts', (req, res) => {
  const alertId = Date.now().toString();
  res.status(201).json({ _id: alertId, ...req.body });
});

// ==================== SETTINGS ====================

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

app.get('/api/config/parking', (req, res) => {
  res.json({
    totalSpaces: 100,
    baseRate: 2.5,
    dynamicPricing: true
  });
});

app.put('/api/config/parking', (req, res) => {
  res.json({ success: true, message: 'Config updated' });
});

// ==================== USERS ====================

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

app.post('/api/users', (req, res) => {
  const userId = Date.now().toString();
  const newUser = { _id: userId, ...req.body };
  res.status(201).json(newUser);
});

app.put('/api/users/:id', (req, res) => {
  res.json({ success: true, message: 'User updated' });
});

app.delete('/api/users/:id', (req, res) => {
  res.json({ success: true, message: 'User deleted' });
});

// ==================== TRANSACTIONS ====================

app.get('/api/transactions', (req, res) => {
  res.json([]);
});

app.post('/api/transactions', (req, res) => {
  const transactionId = Date.now().toString();
  res.status(201).json({ _id: transactionId, ...req.body });
});

// ==================== REPORTS ====================

app.post('/api/reports/pdf', (req, res) => {
  res.json({ success: true, message: 'PDF report generated' });
});

app.get('/api/reports/csv', (req, res) => {
  res.json({ success: true, message: 'CSV report generated' });
});

// ==================== STATS ====================

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

// Export as Netlify Function
module.exports.handler = serverless(app);
