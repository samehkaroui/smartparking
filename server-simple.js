import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test users (no MongoDB required)
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

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentative de connexion:', email);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }

    const user = testUsers.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    if (user.password !== password) {
      console.log('❌ Mot de passe incorrect pour:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Générer un token simple
    const token = Buffer.from(JSON.stringify({
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    })).toString('base64');

    console.log('✅ Connexion réussie pour:', email, '- Rôle:', user.role);

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
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur lors de la connexion' 
    });
  }
});

// Token verification endpoint
app.get('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

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
        walletBalance: user.walletBalance
      }
    });

  } catch (error) {
    res.status(401).json({ success: false, error: 'Token invalide' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mock endpoints for frontend compatibility

// Sessions endpoints
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

// Payments endpoints
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

// Parking endpoints
app.get('/api/parking/spaces', (req, res) => {
  res.json([]);
});

app.get('/api/parking/spaces/:number', (req, res) => {
  res.json({ number: req.params.number, status: 'libre' });
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
  console.log(`🏗️ Génération de ${totalSpaces} places de parking`);
  
  // Simuler la génération de places
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
    message: `${totalSpaces} places créées avec succès`,
    spaces: spaces.length,
    data: spaces
  });
});

app.get('/api/parking/spaces/:number', (req, res) => {
  res.json({ 
    number: req.params.number, 
    status: 'libre',
    zone: 'A',
    type: 'voiture'
  });
});

app.post('/api/parking/cleanup-expired', (req, res) => {
  console.log('🧹 Nettoyage des réservations expirées');
  res.json({ 
    success: true, 
    message: 'Réservations expirées nettoyées',
    cleaned: 0
  });
});

// Notifications endpoints
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

// Alerts endpoints
app.get('/api/alerts', (req, res) => {
  res.json({ alerts: [] });
});

app.post('/api/alerts', (req, res) => {
  const alertId = Date.now().toString();
  res.status(201).json({ _id: alertId, ...req.body });
});

// Settings endpoints
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

// Users endpoints
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
  testUsers.push(newUser);
  res.status(201).json(newUser);
});

app.put('/api/users/:id', (req, res) => {
  res.json({ success: true, message: 'User updated' });
});

app.delete('/api/users/:id', (req, res) => {
  res.json({ success: true, message: 'User deleted' });
});

// Transactions endpoints
app.get('/api/transactions', (req, res) => {
  res.json([]);
});

app.post('/api/transactions', (req, res) => {
  const transactionId = Date.now().toString();
  res.status(201).json({ _id: transactionId, ...req.body });
});

// Reports endpoints
app.post('/api/reports/pdf', (req, res) => {
  res.json({ success: true, message: 'PDF report generated' });
});

app.get('/api/reports/csv', (req, res) => {
  res.json({ success: true, message: 'CSV report generated' });
});

// Stats endpoint
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Serveur Express démarré sur http://localhost:${PORT}`);
  console.log('📋 Utilisateurs de test disponibles:');
  testUsers.forEach(user => {
    console.log(`   - ${user.email} / ${user.password} (${user.role})`);
  });
});
