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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartparking';
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
      serverSelectionTimeoutMS: 5000, // Timeout de 5 secondes
      connectTimeoutMS: 5000,
    });
    
    await client.connect();
    db = client.db('smartparking');
    isMongoConnected = true;
    
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

// Middleware pour vérifier la connexion DB
function requireDB(req, res, next) {
  if (!isMongoConnected) {
    return res.status(503).json({
      success: false,
      error: 'Base de données non disponible. Utilisez le serveur simple à la place.',
      fallbackUrl: 'http://localhost:3001'
    });
  }
  next();
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

app.get('/api/sessions', requireDB, async (req, res) => {
  try {
    const sessionsCollection = db.collection('sessions');
    const sessions = await sessionsCollection.find({})
      .sort({ startTime: -1 })
      .toArray();

    res.json(sessions);
  } catch (error) {
    console.error('❌ Erreur récupération sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/active', requireDB, async (req, res) => {
  try {
    const sessionsCollection = db.collection('sessions');
    const sessions = await sessionsCollection.find({ status: 'active' })
      .sort({ startTime: -1 })
      .toArray();

    res.json(sessions);
  } catch (error) {
    console.error('❌ Erreur récupération sessions actives:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', requireDB, async (req, res) => {
  try {
    const sessionData = req.body;
    
    const sessionsCollection = db.collection('sessions');
    const newSession = {
      ...sessionData,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await sessionsCollection.insertOne(newSession);
    const savedSession = { _id: result.insertedId, ...newSession };
    
    res.status(201).json(savedSession);
  } catch (error) {
    console.error('❌ Erreur création session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID session invalide' });
    }

    const sessionsCollection = db.collection('sessions');
    const session = await sessionsCollection.findOne({ _id: new ObjectId(id) });

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('❌ Erreur récupération session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID session invalide' });
    }

    const sessionsCollection = db.collection('sessions');
    await sessionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Session mise à jour' });
  } catch (error) {
    console.error('❌ Erreur mise à jour session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:id/end', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID session invalide' });
    }

    const sessionsCollection = db.collection('sessions');
    await sessionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'completed', endTime: new Date(), updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Session terminée' });
  } catch (error) {
    console.error('❌ Erreur fin session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/pay', requireDB, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID session invalide' });
    }

    const sessionsCollection = db.collection('sessions');
    await sessionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { paymentStatus: 'paid', amount, paymentMethod, updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Paiement enregistré' });
  } catch (error) {
    console.error('❌ Erreur paiement session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES PAYMENTS ====================

app.get('/api/payments', requireDB, async (req, res) => {
  try {
    const paymentsCollection = db.collection('payments');
    const payments = await paymentsCollection.find({})
      .sort({ paymentTime: -1 })
      .toArray();

    res.json(payments);
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

    const paymentsCollection = db.collection('payments');
    const newPayment = {
      sessionId: new ObjectId(sessionId),
      amount: parseFloat(amount),
      paymentMethod,
      status: 'completed',
      paymentTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await paymentsCollection.insertOne(newPayment);
    res.status(201).json({ _id: result.insertedId, ...newPayment });
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
    const paymentsCollection = db.collection('payments');
    const payments = await paymentsCollection.find({}).toArray();
    
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
    const spacesCollection = db.collection('parkingSpaces');
    const spaces = await spacesCollection.find({}).toArray();
    res.json(spaces);
  } catch (error) {
    console.error('❌ Erreur récupération places:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/reserve', requireDB, async (req, res) => {
  try {
    const { spaceNumber, plate, vehicleType } = req.body;
    
    const spacesCollection = db.collection('parkingSpaces');
    await spacesCollection.updateOne(
      { number: spaceNumber },
      { $set: { status: 'réservé', reservation: { plate, vehicleType, time: new Date() } } }
    );

    res.json({ success: true, message: 'Place réservée' });
  } catch (error) {
    console.error('❌ Erreur réservation place:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/occupy', requireDB, async (req, res) => {
  try {
    const { spaceNumber } = req.body;
    
    const spacesCollection = db.collection('parkingSpaces');
    await spacesCollection.updateOne(
      { number: spaceNumber },
      { $set: { status: 'occupé', updatedAt: new Date() } }
    );

    res.json({ success: true, message: 'Place occupée' });
  } catch (error) {
    console.error('❌ Erreur occupation place:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking/free', requireDB, async (req, res) => {
  try {
    const { spaceNumber } = req.body;
    
    const spacesCollection = db.collection('parkingSpaces');
    await spacesCollection.updateOne(
      { number: spaceNumber },
      { $set: { status: 'libre', reservation: null, updatedAt: new Date() } }
    );

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
    const alertsCollection = db.collection('alerts');
    const alerts = await alertsCollection.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.json({ alerts });
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
    const spacesCollection = db.collection('parkingSpaces');
    const sessionsCollection = db.collection('sessions');
    
    const totalSpaces = await spacesCollection.countDocuments();
    const freeSpaces = await spacesCollection.countDocuments({ status: 'libre' });
    const occupiedSpaces = await spacesCollection.countDocuments({ status: 'occupé' });
    const reservedSpaces = await spacesCollection.countDocuments({ status: 'réservé' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySessions = await sessionsCollection.countDocuments({
      startTime: { $gte: today }
    });
    
    const activeSessions = await sessionsCollection.countDocuments({
      status: 'active'
    });

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

// Gestionnaire pour les routes non trouvées (doit être en dernier)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    suggestion: isMongoConnected ? 
      'Vérifiez l\'URL de l\'API' : 
      'MongoDB non disponible. Utilisez le serveur simple sur http://localhost:3001'
  });
});

// ==================== DÉMARRAGE SERVEUR ====================

async function startServer() {
  try {
    // Essayer de se connecter à MongoDB
    await connectDB();
    
    // Démarrer le serveur dans tous les cas
    app.listen(PORT, () => {
      console.log(`🚀 Serveur MongoDB démarré sur http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      
      if (isMongoConnected) {
        console.log('✅ Mode MongoDB - Toutes les fonctionnalités disponibles');
        console.log(`💰 Payments API: http://localhost:${PORT}/api/payments`);
        console.log(`👤 Users API: http://localhost:${PORT}/api/users`);
        console.log(`💳 Wallet API: http://localhost:${PORT}/api/transactions`);
      } else {
        console.log('⚠️ Mode Fallback - Fonctionnalités limitées');
        console.log('💡 Pour toutes les fonctionnalités, utilisez: http://localhost:3001');
      }
      
      console.log(`🔑 Demo admin: admin@smartparking.com / admin123`);
      console.log(`👤 Demo operator: operator@smartparking.com / operator123`);
      console.log(`👤 Demo customer: customer@smartparking.com / customer123`);
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




// simple server 

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Express démarré sur http://0.0.0.0:${PORT}`);
  console.log(`📡 Accessible sur le réseau local`);
  console.log('📋 Utilisateurs de test disponibles:');
  testUsers.forEach(user => {
    console.log(`   - ${user.email} / ${user.password} (${user.role})`);
  });
});


// Démarrer le serveur
startServer();
