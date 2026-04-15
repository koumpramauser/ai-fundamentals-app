const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// .env dosyasını yükle
dotenv.config();

const app = express();

// --- Middleware Ayarları ---
// index.js içindeki hata yakalayıcıyı bul ve şöyle güncelle:
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Bir şeyler ters gitti!',
        error: err,
        user: null, // Navbar'da kullanıcı adı kontrolü varsa çökmemesi için
        title: 'Hata'
    });
});

// EJS View Engine ayarları
// Bu satırı bul ve tam olarak böyle değiştir:
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.get('/auth/login', (req, res) => {
    // EJS dosyanın içinde hata mesajı veya başka değişkenler varsa, 
    // onları burada 'null' veya boş string olarak tanımlaman şarttır.
    res.render('auth/login', { 
        error: null,    // Eğer login.ejs içinde 'error' kullanılıyorsa
        message: null   // Eğer login.ejs içinde 'message' kullanılıyorsa
    });
});

// --- Mock Middleware (Daha önce tanımladığın requireLogin vb. buraya gelecek) ---
const requireLogin = (req, res, next) => {
    // Session kontrol mantığın buraya
    next();
};

// --- Rotalar (Routes) ---

// 1. Ana Sayfa Rotası (404 hatasını çözen en kritik kısım)
app.get('/', (req, res) => {
    // Kullanıcıyı direkt login sayfasına veya dashboard'a yönlendir
    res.redirect('/auth/login');
});

// 2. Auth Rotaları
app.get('/auth/login', (req, res) => {
    res.render('auth/login');
});

app.get('/auth/register', (req, res) => {
    res.render('auth/register');
});

// 3. Öğrenci Paneli Rotaları
app.get('/student/dashboard', requireLogin, (req, res) => {
    res.render('student/dashboard');
});

app.get('/student/workspace', requireLogin, (req, res) => {
    res.render('student/workspace', { review: null, error: null });
});

// 4. Leaderboard Rotası
app.get('/leaderboard', requireLogin, async (req, res) => {
    try {
        // Burada db.getLeaderboard gibi fonksiyonlarını çağırabilirsin
        res.render('leaderboard', { leaderBoard: [], myScore: 0 });
    } catch (err) {
        res.render('error', { message: 'Liderlik tablosu yüklenemedi.' });
    }
});

// --- Hata Yönetimi ---
app.use((req, res) => {
    res.status(404).render('error', { message: 'Sayfa bulunamadı.' });
});

// --- Vercel İçin Kritik Export ---
// Bu satır olmazsa Vercel projeyi çalıştıramaz
module.exports = app;

// --- Yerel Geliştirme (Local Dev) ---
// Sadece localhost'ta çalışırken portu dinle
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`StudyAI Erlangen'de http://localhost:${PORT} üzerinde çalışıyor.`);
    });
}// ... (Senin o 380 satırlık kodun burada devam ediyor olsun) ...

// --- BU KISMI EN ALTA EKLE ---

// 1. Ana sayfa isteği gelince ne yapacağını bilemediği için 404 veriyordu, bunu ekle:
app.get('/', (req, res) => {
    res.redirect('/auth/login'); 
});

// 2. Vercel'in senin bu devasa 380 satırlık kodu "fonksiyon" olarak görmesi için:
module.exports = app;

// 3. Mevcut app.listen satırını şu şekilde değiştir ki Vercel ile çakışmasın:
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Local dev: http://localhost:${PORT}`));
}