const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS - Herkesin bağlanabilmesi için
app.use(cors());
app.use(express.json());

// Socket.io kurulumu
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Bellekte tutulan veriler
let activeUsers = new Map(); // Bağlı kullanıcılar
let currentServer = null; // Aktif server bilgisi

// Ana sayfa (test için)
app.get('/', (req, res) => {
  res.send(`
    <h1>🎯 OutJoiner Backend Çalışıyor!</h1>
    <p>Aktif kullanıcı: ${activeUsers.size}</p>
    <p>Son bulunan server: ${currentServer ? currentServer.jobId : 'Yok'}</p>
  `);
});

// Socket.io - Kullanıcılar bağlandığında
io.on('connection', (socket) => {
  console.log('✅ Yeni kullanıcı bağlandı:', socket.id);

  // Kullanıcı kaydı
  socket.on('register', (data) => {
    activeUsers.set(socket.id, {
      username: data.username,
      userId: data.userId,
      connectedAt: new Date()
    });

    console.log(`👤 Kullanıcı: ${data.username}`);

    // İstatistik gönder
    io.emit('stats', {
      activeUsers: activeUsers.size
    });

    // Eğer aktif server varsa hemen gönder
    if (currentServer && currentServer.expiresAt > Date.now()) {
      socket.emit('server-found', currentServer);
    }
  });

  // Kullanıcı ayrıldığında
  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    console.log('❌ Kullanıcı ayrıldı:', socket.id);

    io.emit('stats', {
      activeUsers: activeUsers.size
    });
  });
});

// API - Bot scanner'ların server bildirmesi için
app.post('/api/report-server', (req, res) => {
  const { jobId, placeId, brainrots, scannerId, secretKey } = req.body;

  // Güvenlik kontrolü
  if (secretKey !== 'BURAYA_GİZLİ_ANAHTAR_YAZ') {
    return res.status(401).json({ error: 'Yetkisiz erişim!' });
  }

  console.log('🎯 YENİ SERVER BULUNDU!');
  console.log('Job ID:', jobId);
  console.log('Brainrotlar:', brainrots);

  // Server bilgisini kaydet
  currentServer = {
    jobId: jobId,
    placeId: placeId,
    brainrots: brainrots,
    reportedAt: new Date().toISOString(),
    scannerId: scannerId,
    expiresAt: Date.now() + (60 * 1000) // 60 saniye geçerli
  };

  // TÜM kullanıcılara WebSocket ile bildir
  io.emit('server-found', currentServer);

  console.log(`📢 ${activeUsers.size} kullanıcıya bildirim gönderildi!`);

  res.json({ 
    success: true,
    notifiedUsers: activeUsers.size 
  });
});

// İstatistikler endpoint'i (Roblox script için)
app.get('/api/stats', (req, res) => {
  res.json({
    activeUsers: activeUsers.size,
    currentServer: currentServer && currentServer.expiresAt > Date.now() ? currentServer : null,
    serverTime: new Date().toISOString()
  });
});

// Test endpoint'i
app.post('/api/test', (req, res) => {
  console.log('🧪 Test isteği alındı:', req.body);
  res.json({ message: 'Test başarılı!' });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 Backend sunucu çalışıyor!');
  console.log('📡 Port:', PORT);
  console.log('🌐 URL:', `http://localhost:${PORT}`);
});
