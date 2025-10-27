// Vercel Serverless Function - نسخة من server-simple.js
import express from 'express';

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

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }

    const user = testUsers.find(u => u.email === email);
    
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Vercel API is running' });
});

// جميع الـ endpoints الأخرى...
app.get('/api/sessions', (req, res) => res.json([]));
app.get('/api/users', (req, res) => res.json(testUsers));
app.get('/api/parking/spaces', (req, res) => res.json([]));
app.post('/api/parking/generate-spaces', (req, res) => {
  const { totalSpaces } = req.body;
  const spaces = [];
  for (let i = 1; i <= totalSpaces; i++) {
    spaces.push({
      _id: i,
      number: `A${String(i).padStart(3, '0')}`,
      zone: 'A',
      type: 'voiture',
      status: 'libre'
    });
  }
  res.json({ success: true, data: spaces });
});

export default app;
