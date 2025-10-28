import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
// Use MONGO_PORT or default to 3002 to avoid conflict with simple server on 3001
const PORT = process.env.MONGO_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://samhkaroui_db_user:44605775@parking.rgvpb46.mongodb.net/?appName=parking';
let client;
let db;
let isMongoConnected = false;

// Données de fallback pour quand MongoDB n'est pas disponible
const fallbackUsers = [
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

const fallbackParkingSpaces = [
  { _id: 1, number: "A001", zone: "A", type: "voiture", vehicleType: "voiture", status: "libre", createdAt: new Date(), updatedAt: new Date() },
  { _id: 2, number: "A002", zone: "A", type: "voiture", vehicleType: "voiture", status: "libre", createdAt: new Date(), updatedAt: new Date() },
  { _id: 3, number: "A003", zone: "A", type: "camion", vehicleType: "camion", status: "libre", createdAt: new Date(), updatedAt: new Date() },
  { _id: 4, number: "B001", zone: "B", type: "moto", vehicleType: "moto", status: "libre", createdAt: new Date(), updatedAt: new Date() },
  { _id: 5, number: "B002", zone: "B", type: "voiture", vehicleType: "voiture", status: "libre", createdAt: new Date(), updatedAt: new Date() }
];

// Connexion à MongoDB avec gestion d'erreur améliorée
async function connectDB() {
  try {
    console.log('🔄 Tentative de connexion à MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true,
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
    });
    
    await client.connect();
    db = client.db('smartparking');
    isMongoConnected = true;
    
    // Gérer les événements de connexion
    client.on('serverHeartbeatFailed', () => {
      console.warn('⚠️ MongoDB heartbeat failed - connection may be unstable');
    });
    
    client.on('close', () => {
      console.warn('⚠️ MongoDB connection closed');
      isMongoConnected = false;
    });
    
    console.log('✅ Connecté à MongoDB');
    
    // Créer les collections et index si elles n'existent pas
    try {
      await db.collection('parkingSpaces').createIndex({ number: 1 }, { unique: true });
      await db.collection('spaceStatusHistory').createIndex({ spaceNumber: 1, timestamp: -1 });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('sessions').createIndex({ 'vehicle.plate': 1 });
      await db.collection('sessions').createIndex({ userId: 1 });
      await db.collection('alerts').createIndex({ timestamp: -1 });
      await db.collection('payments').createIndex({ sessionId: 1 });
      await db.collection('payments').createIndex({ paymentTime: -1 });
      await db.collection('transactions').createIndex({ userId: 1, timestamp: -1 });
      await db.collection('notifications').createIndex({ userId: 1, timestamp: -1 });
      
      console.log('✅ Index MongoDB créés');
    } catch (indexError) {
      console.warn('⚠️ Erreur création index (non critique):', indexError.message);
    }
    
    // Initialiser les données de base
    await initializeData();
    
    return db;
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error.message);
    console.log('🔄 Basculement en mode fallback (sans MongoDB)');
    isMongoConnected = false;
    return null;
  }
}

// Initialiser les données de base
async function initializeData() {
  if (!isMongoConnected) return;
  
  try {
    // Initialiser les utilisateurs
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    if (usersCount === 0) {
      await usersCollection.insertMany(fallbackUsers);
      console.log('✅ Utilisateurs de démo créés');
    }
    
    // Initialiser les places de parking
    const spacesCollection = db.collection('parkingSpaces');
    const spacesCount = await spacesCollection.countDocuments();
    if (spacesCount === 0) {
      await spacesCollection.insertMany(fallbackParkingSpaces);
      console.log('✅ Places de parking créées');
    }
  } catch (error) {
    console.warn('⚠️ Erreur initialisation données:', error.message);
  }
}

// Middleware pour vérifier la connexion DB (optionnel - ne bloque plus les requêtes)
function requireDB(req, res, next) {
  // Ne plus bloquer les requêtes - juste passer au suivant
  // Les routes individuelles géreront le mode fallback
  next();
}

// Helper function to handle MongoDB operations with automatic fallback
async function safeMongoOperation(operation, fallbackValue = null) {
  if (!isMongoConnected) {
    return fallbackValue;
  }
  
  try {
    return await operation();
  } catch (error) {
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      console.warn('⚠️ MongoDB connection lost, switching to fallback mode');
      isMongoConnected = false;
    }
    return fallbackValue;
  }
}

// ==================== ROUTES AUTHENTIFICATION ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }

    let user;
    
    if (isMongoConnected) {
      const usersCollection = db.collection('users');
      user = await usersCollection.findOne({ email });
    } else {
      // Mode fallback
      user = fallbackUsers.find(u => u.email === email);
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Mettre à jour la dernière connexion (seulement si MongoDB est disponible)
    if (isMongoConnected) {
      try {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date() } }
        );
      } catch (updateError) {
        console.warn('⚠️ Erreur mise à jour lastLogin:', updateError.message);
      }
    }

    // Générer un token simple
    const token = Buffer.from(JSON.stringify({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    })).toString('base64');

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        status: user.status,
        name: user.name,
        walletBalance: user.walletBalance || 0
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

app.get('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    let user;
    
    if (isMongoConnected) {
      user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    } else {
      user = fallbackUsers.find(u => u._id === decoded.userId);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
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

// ==================== ROUTES UTILISATEURS ====================

app.get('/api/users', async (req, res) => {
  try {
    console.log('📡 Récupération de tous les utilisateurs');
    
    let users;
    if (isMongoConnected) {
      const usersCollection = db.collection('users');
      users = await usersCollection.find({}).toArray();
    } else {
      users = fallbackUsers;
    }
    
    console.log(`✅ ${users.length} utilisateurs récupérés`);
    
    // Transformation pour le frontend
    const transformedUsers = users.map(user => ({
      _id: user._id,
      id: user._id.toString(),
      name: user.name || 'Utilisateur Sans Nom',
      email: user.email,
      phone: user.phone || '0000000000',
      password: user.password || 'password',
      role: user.role || 'customer',
      status: user.status || 'active',
      walletBalance: user.walletBalance || 0,
      registrationDate: user.registrationDate || user.createdAt || new Date(),
      lastLogin: user.lastLogin || null,
      totalSessions: user.totalSessions || 0,
      totalSpent: user.totalSpent || 0,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date()
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error('❌ Erreur récupération utilisateurs:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des utilisateurs',
      details: error.message 
    });
  }
});

// Route de santé avec informations sur l'état de la base de données
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    database: isMongoConnected ? 'Connected' : 'Disconnected (Fallback Mode)',
    port: PORT,
    fallbackMode: !isMongoConnected
  });
});

// Endpoint pour basculer vers le serveur simple
app.get('/api/fallback-info', (req, res) => {
  res.json({
    message: 'MongoDB non disponible',
    recommendation: 'Utilisez le serveur simple sur le port 3001',
    simpleServerUrl: 'http://localhost:3001',
    currentServer: `http://localhost:${PORT}`,
    mongoStatus: isMongoConnected ? 'connected' : 'disconnected'
  });
});

// ==================== ROUTES UTILISATEURS (SUITE) ====================

// GET /api/users/:id - Récupérer un utilisateur par ID
app.get('/api/users/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📡 Récupération utilisateur par ID:', id);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const transformedUser = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || '0000000000',
      role: user.role,
      status: user.status,
      walletBalance: user.walletBalance || 0,
      registrationDate: user.registrationDate || user.createdAt,
      lastLogin: user.lastLogin,
      totalSessions: user.totalSessions || 0,
      totalSpent: user.totalSpent || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    console.log('✅ Utilisateur récupéré:', id);
    res.json(transformedUser);
  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération de l\'utilisateur',
      details: error.message 
    });
  }
});

// POST /api/users - Créer un nouvel utilisateur
app.post('/api/users', requireDB, async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    console.log('📤 Création nouvel utilisateur:', { name, email, phone, role });

    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Données manquantes: name, email et password sont requis' 
      });
    }

    const usersCollection = db.collection('users');
    
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Un utilisateur avec cet email existe déjà' 
      });
    }

    const newUser = {
      name,
      email,
      phone: phone || '',
      password,
      role: role || 'customer',
      status: 'active',
      walletBalance: 0,
      registrationDate: new Date(),
      lastLogin: null,
      totalSessions: 0,
      totalSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(newUser);
    const savedUser = { 
      _id: result.insertedId, 
      id: result.insertedId.toString(),
      ...newUser 
    };
    
    console.log('✅ NOUVEAU utilisateur créé:', savedUser._id);
    res.status(201).json(savedUser);
  } catch (error) {
    console.error('❌ Erreur création utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la création de l\'utilisateur',
      details: error.message 
    });
  }
});

// PUT /api/users/:id - Mettre à jour un utilisateur
app.put('/api/users/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('✏️ Mise à jour utilisateur:', id, updates);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const usersCollection = db.collection('users');
    
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: 'Aucune modification effectuée' });
    }

    console.log('✅ Utilisateur mis à jour:', id);
    res.json({ success: true, message: 'Utilisateur mis à jour avec succès' });
  } catch (error) {
    console.error('❌ Erreur mise à jour utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la mise à jour de l\'utilisateur',
      details: error.message 
    });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur
app.delete('/api/users/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Suppression utilisateur:', id);

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    const usersCollection = db.collection('users');
    
    const existingUser = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(400).json({ error: 'Échec de la suppression' });
    }

    console.log('✅ Utilisateur supprimé:', id);
    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression utilisateur:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la suppression de l\'utilisateur',
      details: error.message 
    });
  }
});

// ==================== ROUTES TRANSACTIONS ====================

app.get('/api/transactions', requireDB, async (req, res) => {
  try {
    const { userId } = req.query;

    console.log('📊 Récupération transactions pour utilisateur:', userId);

    const transactionsCollection = db.collection('transactions');
    let query = {};
    
    if (userId) {
      query.userId = userId;
    }

    const transactions = await transactionsCollection.find(query)
      .sort({ timestamp: -1 })
      .toArray();

    console.log(`✅ ${transactions.length} transactions récupérées`);
    res.json(transactions);
  } catch (error) {
    console.error('❌ Erreur récupération transactions:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des transactions',
      details: error.message 
    });
  }
});

app.post('/api/transactions', requireDB, async (req, res) => {
  try {
    const { userId, type, amount, description } = req.body;

    console.log('📤 Création nouvelle transaction:', { userId, type, amount });

    if (!userId || !type || !amount) {
      return res.status(400).json({ 
        error: 'Données manquantes: userId, type et amount sont requis' 
      });
    }

    const transactionsCollection = db.collection('transactions');
    
    const newTransaction = {
      userId,
      type,
      amount: parseFloat(amount),
      description: description || '',
      timestamp: new Date(),
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await transactionsCollection.insertOne(newTransaction);
    const savedTransaction = { _id: result.insertedId, ...newTransaction };
    
    console.log('✅ NOUVELLE transaction créée:', savedTransaction._id);
    res.status(201).json(savedTransaction);
  } catch (error) {
    console.error('❌ Erreur création transaction:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la création de la transaction',
      details: error.message 
    });
  }
});

// ==================== ROUTES NOTIFICATIONS ====================

app.get('/api/notifications', requireDB, async (req, res) => {
  try {
    const { userId } = req.query;

    console.log('📊 Récupération notifications pour utilisateur:', userId);

    const notificationsCollection = db.collection('notifications');
    let query = {};
    
    if (userId) {
      query.userId = userId;
    }

    const notifications = await notificationsCollection.find(query)
      .sort({ timestamp: -1 })
      .toArray();

    console.log(`✅ ${notifications.length} notifications récupérées`);
    res.json(notifications);
  } catch (error) {
    console.error('❌ Erreur récupération notifications:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des notifications',
      details: error.message 
    });
  }
});

app.post('/api/notifications', requireDB, async (req, res) => {
  try {
    const { userId, type, title, message, category } = req.body;

    console.log('📤 Création nouvelle notification:', { userId, type, title });

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ 
        error: 'Données manquantes: userId, type, title et message sont requis' 
      });
    }

    const notificationsCollection = db.collection('notifications');
    
    const newNotification = {
      userId,
      type,
      title,
      message,
      category: category || 'system',
      timestamp: new Date(),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notificationsCollection.insertOne(newNotification);
    const savedNotification = { _id: result.insertedId, ...newNotification };
    
    console.log('✅ NOUVELLE notification créée:', savedNotification._id);
    res.status(201).json(savedNotification);
  } catch (error) {
    console.error('❌ Erreur création notification:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la création de la notification',
      details: error.message 
    });
  }
});

app.get('/api/notifications/unread', requireDB, async (req, res) => {
  try {
    const { userId } = req.query;
    
    const notificationsCollection = db.collection('notifications');
    let query = { read: false };
    
    if (userId) {
      query.userId = userId;
    }

    const notifications = await notificationsCollection.find(query)
      .sort({ timestamp: -1 })
      .toArray();

    res.json(notifications);
  } catch (error) {
    console.error('❌ Erreur récupération notifications non lues:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/notifications/:id/read', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID notification invalide' });
    }

    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { read: true, updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('❌ Erreur marquage notification:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID notification invalide' });
    }

    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: 'Notification supprimée' });
  } catch (error) {
    console.error('❌ Erreur suppression notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES SESSIONS ====================

// In-memory sessions for fallback mode
const fallbackSessions = [];

app.get('/api/sessions', requireDB, async (req, res) => {
  try {
    if (isMongoConnected) {
      try {
        const sessionsCollection = db.collection('sessions');
        const sessions = await sessionsCollection.find({})
          .sort({ startTime: -1 })
          .toArray();
        return res.json(sessions);
      } catch (mongoError) {
        console.warn('⚠️ MongoDB error, switching to fallback:', mongoError.message);
        isMongoConnected = false;
        return res.json(fallbackSessions);
      }
    }
    
    // Fallback mode
    res.json(fallbackSessions);
  } catch (error) {
    console.error('❌ Erreur récupération sessions:', error);
    res.json(fallbackSessions); // Return fallback data instead of error
  }
});

app.get('/api/sessions/active', requireDB, async (req, res) => {
  try {
    if (isMongoConnected) {
      const sessionsCollection = db.collection('sessions');
      const sessions = await sessionsCollection.find({ status: 'active' })
        .sort({ startTime: -1 })
        .toArray();
      return res.json(sessions);
    }
    
    // Fallback mode
    res.json(fallbackSessions.filter(s => s.status === 'active'));
  } catch (error) {
    console.error('❌ Erreur récupération sessions actives:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', requireDB, async (req, res) => {
  try {
    const sessionData = req.body;
    const newSession = {
      ...sessionData,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (isMongoConnected) {
      const sessionsCollection = db.collection('sessions');
      const result = await sessionsCollection.insertOne(newSession);
      const savedSession = { _id: result.insertedId, ...newSession };
      return res.status(201).json(savedSession);
    }
    
    // Fallback mode
    const sessionId = Date.now().toString();
    const savedSession = { _id: sessionId, ...newSession };
    fallbackSessions.push(savedSession);
    res.status(201).json(savedSession);
  } catch (error) {
    console.error('❌ Erreur création session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isMongoConnected && ObjectId.isValid(id)) {
      const sessionsCollection = db.collection('sessions');
      const session = await sessionsCollection.findOne({ _id: new ObjectId(id) });
      if (session) {
        return res.json({ success: true, session });
      }
    }
    
    // Fallback mode
    const session = fallbackSessions.find(s => s._id === id);
    if (session) {
      return res.json({ success: true, session });
    }
    
    res.status(404).json({ error: 'Session non trouvée' });
  } catch (error) {
    console.error('❌ Erreur récupération session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (isMongoConnected && ObjectId.isValid(id)) {
      const sessionsCollection = db.collection('sessions');
      await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } }
      );
      return res.json({ success: true, message: 'Session mise à jour' });
    }
    
    // Fallback mode
    const sessionIndex = fallbackSessions.findIndex(s => s._id === id);
    if (sessionIndex !== -1) {
      fallbackSessions[sessionIndex] = { 
        ...fallbackSessions[sessionIndex], 
        ...updates, 
        updatedAt: new Date() 
      };
      return res.json({ success: true, message: 'Session mise à jour' });
    }
    
    res.status(404).json({ error: 'Session non trouvée' });
  } catch (error) {
    console.error('❌ Erreur mise à jour session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id/end', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isMongoConnected && ObjectId.isValid(id)) {
      const sessionsCollection = db.collection('sessions');
      await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'completed', endTime: new Date(), updatedAt: new Date() } }
      );
      return res.json({ success: true, message: 'Session terminée' });
    }
    
    // Fallback mode
    const sessionIndex = fallbackSessions.findIndex(s => s._id === id);
    if (sessionIndex !== -1) {
      fallbackSessions[sessionIndex].status = 'completed';
      fallbackSessions[sessionIndex].endTime = new Date();
      fallbackSessions[sessionIndex].updatedAt = new Date();
      return res.json({ success: true, message: 'Session terminée' });
    }
    
    res.status(404).json({ error: 'Session non trouvée' });
  } catch (error) {
    console.error('❌ Erreur fin session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/pay', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;
    
    if (isMongoConnected && ObjectId.isValid(id)) {
      const sessionsCollection = db.collection('sessions');
      await sessionsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus: 'paid', amount, paymentMethod, updatedAt: new Date() } }
      );
      return res.json({ success: true, message: 'Paiement enregistré' });
    }
    
    // Fallback mode
    const sessionIndex = fallbackSessions.findIndex(s => s._id === id);
    if (sessionIndex !== -1) {
      fallbackSessions[sessionIndex].paymentStatus = 'paid';
      fallbackSessions[sessionIndex].amount = amount;
      fallbackSessions[sessionIndex].paymentMethod = paymentMethod;
      fallbackSessions[sessionIndex].updatedAt = new Date();
      return res.json({ success: true, message: 'Paiement enregistré' });
    }
    
    res.status(404).json({ error: 'Session non trouvée' });
  } catch (error) {
    console.error('❌ Erreur paiement session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES PAYMENTS ====================

// In-memory payments for fallback mode
const fallbackPayments = [];

app.get('/api/payments', requireDB, async (req, res) => {
  try {
    if (isMongoConnected) {
      const paymentsCollection = db.collection('payments');
      const payments = await paymentsCollection.find({})
        .sort({ paymentTime: -1 })
        .toArray();
      return res.json(payments);
    }
    
    res.json(fallbackPayments);
  } catch (error) {
    console.error('❌ Erreur récupération paiements:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', requireDB, async (req, res) => {
  try {
    const { sessionId, amount, paymentMethod } = req.body;

    if (!sessionId || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const newPayment = {
      sessionId,
      amount: parseFloat(amount),
      paymentMethod,
      status: 'completed',
      paymentTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isMongoConnected) {
      const paymentsCollection = db.collection('payments');
      newPayment.sessionId = new ObjectId(sessionId);
      const result = await paymentsCollection.insertOne(newPayment);
      return res.status(201).json({ _id: result.insertedId, ...newPayment });
    }
    
    const paymentId = Date.now().toString();
    const savedPayment = { _id: paymentId, ...newPayment };
    fallbackPayments.push(savedPayment);
    res.status(201).json(savedPayment);
  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments/reports', requireDB, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.paymentTime = {};
      if (startDate) query.paymentTime.$gte = new Date(startDate);
      if (endDate) query.paymentTime.$lte = new Date(endDate);
    }

    const paymentsCollection = db.collection('payments');
    const payments = await paymentsCollection.find(query)
      .sort({ paymentTime: -1 })
      .toArray();

    res.json(payments);
  } catch (error) {
    console.error('❌ Erreur rapport paiements:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments/stats', requireDB, async (req, res) => {
  try {
    let payments = [];
    
    if (isMongoConnected) {
      const paymentsCollection = db.collection('payments');
      payments = await paymentsCollection.find({}).toArray();
    } else {
      payments = fallbackPayments;
    }
    
    const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const count = payments.length;

    res.json({ total, count, average: count > 0 ? total / count : 0 });
  } catch (error) {
    console.error('❌ Erreur stats paiements:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES PARKING ====================

app.get('/api/parking/spaces', requireDB, async (req, res) => {
  try {
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      const spaces = await spacesCollection.find({}).toArray();
      return res.json(spaces);
    }
    res.json(fallbackParkingSpaces);
  } catch (error) {
    console.error('❌ Erreur récupération places:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/reserve', requireDB, async (req, res) => {
  try {
    const { spaceNumber, plate, vehicleType } = req.body;
    
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      await spacesCollection.updateOne(
        { number: spaceNumber },
        { $set: { status: 'réservé', reservation: { plate, vehicleType, time: new Date() } } }
      );
    } else {
      const space = fallbackParkingSpaces.find(s => s.number === spaceNumber);
      if (space) {
        space.status = 'réservé';
        space.reservation = { plate, vehicleType, time: new Date() };
      }
    }

    res.json({ success: true, message: 'Place réservée' });
  } catch (error) {
    console.error('❌ Erreur réservation place:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/occupy', requireDB, async (req, res) => {
  try {
    const { spaceNumber } = req.body;
    
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      await spacesCollection.updateOne(
        { number: spaceNumber },
        { $set: { status: 'occupé', updatedAt: new Date() } }
      );
    } else {
      const space = fallbackParkingSpaces.find(s => s.number === spaceNumber);
      if (space) {
        space.status = 'occupé';
        space.updatedAt = new Date();
      }
    }

    res.json({ success: true, message: 'Place occupée' });
  } catch (error) {
    console.error('❌ Erreur occupation place:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/free', requireDB, async (req, res) => {
  try {
    const { spaceNumber } = req.body;
    
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      await spacesCollection.updateOne(
        { number: spaceNumber },
        { $set: { status: 'libre', reservation: null, updatedAt: new Date() } }
      );
    } else {
      const space = fallbackParkingSpaces.find(s => s.number === spaceNumber);
      if (space) {
        space.status = 'libre';
        space.reservation = null;
        space.updatedAt = new Date();
      }
    }

    res.json({ success: true, message: 'Place libérée' });
  } catch (error) {
    console.error('❌ Erreur libération place:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES SETTINGS ====================

app.get('/api/settings', requireDB, async (req, res) => {
  try {
    const settingsCollection = db.collection('settings');
    const configDoc = await settingsCollection.findOne({ type: 'parkingConfig' });
    const rulesDoc = await settingsCollection.findOne({ type: 'pricingRules' });

    res.json({
      success: true,
      config: configDoc || {},
      pricingRules: rulesDoc?.rules || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', requireDB, async (req, res) => {
  try {
    const { config, pricingRules } = req.body;
    
    const settingsCollection = db.collection('settings');
    
    if (config) {
      await settingsCollection.updateOne(
        { type: 'parkingConfig' },
        { $set: { ...config, type: 'parkingConfig', updatedAt: new Date() } },
        { upsert: true }
      );
    }
    
    if (pricingRules) {
      await settingsCollection.updateOne(
        { type: 'pricingRules' },
        { $set: { rules: pricingRules, type: 'pricingRules', updatedAt: new Date() } },
        { upsert: true }
      );
    }

    res.json({ success: true, message: 'Configuration sauvegardée' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config/parking', requireDB, async (req, res) => {
  try {
    const settingsCollection = db.collection('settings');
    const configDoc = await settingsCollection.findOne({ type: 'parkingConfig' });
    res.json(configDoc || {});
  } catch (error) {
    console.error('❌ Erreur récupération config parking:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/config/parking', requireDB, async (req, res) => {
  try {
    const config = req.body;
    
    const settingsCollection = db.collection('settings');
    await settingsCollection.updateOne(
      { type: 'parkingConfig' },
      { $set: { ...config, type: 'parkingConfig', updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true, message: 'Config mise à jour' });
  } catch (error) {
    console.error('❌ Erreur mise à jour config:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES ALERTS ====================

app.get('/api/alerts', requireDB, async (req, res) => {
  try {
    if (isMongoConnected) {
      const alertsCollection = db.collection('alerts');
      const alerts = await alertsCollection.find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
      return res.json({ alerts });
    }
    
    res.json({ alerts: [] });
  } catch (error) {
    console.error('❌ Erreur récupération alertes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts', requireDB, async (req, res) => {
  try {
    const alertData = req.body;
    
    const alertsCollection = db.collection('alerts');
    const newAlert = {
      ...alertData,
      timestamp: new Date(),
      read: false
    };

    const result = await alertsCollection.insertOne(newAlert);
    res.status(201).json({ _id: result.insertedId, ...newAlert });
  } catch (error) {
    console.error('❌ Erreur création alerte:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES STATS ====================

app.get('/api/stats', requireDB, async (req, res) => {
  try {
    let totalSpaces, freeSpaces, occupiedSpaces, reservedSpaces, todaySessions, activeSessions;
    
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      const sessionsCollection = db.collection('sessions');
      
      totalSpaces = await spacesCollection.countDocuments();
      freeSpaces = await spacesCollection.countDocuments({ status: 'libre' });
      occupiedSpaces = await spacesCollection.countDocuments({ status: 'occupé' });
      reservedSpaces = await spacesCollection.countDocuments({ status: 'réservé' });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      todaySessions = await sessionsCollection.countDocuments({
        startTime: { $gte: today }
      });
      
      activeSessions = await sessionsCollection.countDocuments({
        status: 'active'
      });
    } else {
      // Fallback mode - calculate from in-memory data
      totalSpaces = fallbackParkingSpaces.length;
      freeSpaces = fallbackParkingSpaces.filter(s => s.status === 'libre').length;
      occupiedSpaces = fallbackParkingSpaces.filter(s => s.status === 'occupé').length;
      reservedSpaces = fallbackParkingSpaces.filter(s => s.status === 'réservé').length;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      todaySessions = fallbackSessions.filter(s => new Date(s.startTime) >= today).length;
      activeSessions = fallbackSessions.filter(s => s.status === 'active').length;
    }

    res.json({
      spaces: {
        total: totalSpaces,
        free: freeSpaces,
        occupied: occupiedSpaces,
        reserved: reservedSpaces,
        occupancyRate: totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0
      },
      sessions: {
        today: todaySessions,
        active: activeSessions
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES REPORTS ====================

app.post('/api/reports/pdf', requireDB, async (req, res) => {
  try {
    res.json({ success: true, message: 'PDF report generation not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/csv', requireDB, async (req, res) => {
  try {
    res.json({ success: true, message: 'CSV report generation not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestionnaire d'erreur global
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur non gérée:', error);
  res.status(500).json({
    success: false,
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
  });
});

// ==================== ROUTES PARKING SPACES (FALLBACK) ====================

// Route pour générer des places de parking (fallback mode)
app.post('/api/parking/generate-spaces', async (req, res) => {
  try {
    const { totalSpaces } = req.body;
    console.log(`🏗️ Génération de ${totalSpaces} places de parking`);
    
    const spaces = [];
    const zones = ['A', 'B', 'C', 'D'];
    const types = ['voiture', 'moto', 'camion'];
    
    for (let i = 1; i <= totalSpaces; i++) {
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const number = `${zone}${String(i).padStart(3, '0')}`;
      
      spaces.push({
        number,
        zone,
        type,
        vehicleType: type,
        status: 'libre',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Si MongoDB est connecté, sauvegarder dans la base
    if (isMongoConnected && spaces.length > 0) {
      try {
        const spacesCollection = db.collection('parkingSpaces');
        await spacesCollection.deleteMany({}); // Nettoyer les anciennes places
        await spacesCollection.insertMany(spaces);
        console.log(`✅ ${totalSpaces} places sauvegardées dans MongoDB`);
      } catch (dbError) {
        console.warn('⚠️ Erreur sauvegarde MongoDB:', dbError.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `${totalSpaces} places créées avec succès`,
      spaces: spaces.length,
      data: spaces
    });
  } catch (error) {
    console.error('❌ Erreur génération places:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/parking/spaces/:number', async (req, res) => {
  try {
    const { number } = req.params;
    
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      const space = await spacesCollection.findOne({ number });
      if (space) {
        return res.json(space);
      }
    }
    
    // Fallback
    res.json({ 
      number, 
      status: 'libre',
      zone: 'A',
      type: 'voiture'
    });
  } catch (error) {
    console.error('❌ Erreur récupération place:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/cleanup-expired', async (req, res) => {
  try {
    console.log('🧹 Nettoyage des réservations expirées');
    
    let cleaned = 0;
    if (isMongoConnected) {
      const spacesCollection = db.collection('parkingSpaces');
      const result = await spacesCollection.updateMany(
        { status: 'réservé', 'reservation.time': { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
        { $set: { status: 'libre', reservation: null } }
      );
      cleaned = result.modifiedCount;
    }
    
    res.json({ 
      success: true, 
      message: 'Réservations expirées nettoyées',
      cleaned
    });
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gestionnaire pour les routes non trouvées (doit être en dernier)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    suggestion: isMongoConnected ? 
      'Vérifiez l\'URL de l\'API' : 
      'MongoDB non disponible - Mode fallback actif'
  });
});

// ==================== DÉMARRAGE SERVEUR ====================

async function startServer() {
  try {
    // Essayer de se connecter à MongoDB
    await connectDB();
    
    // Démarrer le serveur dans tous les cas
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      
      if (isMongoConnected) {
        console.log('✅ Mode MongoDB - Toutes les fonctionnalités disponibles');
        console.log(`💰 Payments API: http://localhost:${PORT}/api/payments`);
        console.log(`👤 Users API: http://localhost:${PORT}/api/users`);
        console.log(`💳 Wallet API: http://localhost:${PORT}/api/transactions`);
      } else {
        console.log('⚠️ Mode Fallback - Fonctionnalités de base disponibles');
        console.log('💡 Certaines fonctionnalités utilisent des données en mémoire');
      }
      
      console.log(`\n🔑 Comptes de démonstration:`);
      console.log(`   Admin: admin@smartparking.com / admin123`);
      console.log(`   Opérateur: operator@smartparking.com / operator123`);
      console.log(`   Client: customer@smartparking.com / customer123`);
    });
  } catch (error) {
    console.error('❌ Erreur critique au démarrage:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🔄 Arrêt du serveur...');
  if (client && isMongoConnected) {
    try {
      await client.close();
      console.log('✅ Connexion MongoDB fermée');
    } catch (error) {
      console.error('❌ Erreur fermeture MongoDB:', error);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Arrêt du serveur (SIGTERM)...');
  if (client && isMongoConnected) {
    try {
      await client.close();
      console.log('✅ Connexion MongoDB fermée');
    } catch (error) {
      console.error('❌ Erreur fermeture MongoDB:', error);
    }
  }
  process.exit(0);
});

// Démarrer le serveur
startServer();
