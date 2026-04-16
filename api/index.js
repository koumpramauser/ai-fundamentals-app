const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// 1. Önce yapılandırmaları yükle
dotenv.config();

const app = express();

// 2. View Engine (EJS) Ayarları
// Vercel'de klasör yapısı değişebildiği için path.join kullanmak en güvenlisidir.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 3. Middleware Ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosyalar (css, js vb.) için
app.use(express.static(path.join(__dirname, '../public')));

// Senin yazdığın session kontrol middleware'i
app.use((req, res, next) => {
    // Eğer session kullanıyorsan req.session.user'ı, kullanmıyorsan null döner
    res.locals.sessionUser = (req.session && req.session.user) ? req.session.user : null;
    next();
});

// --- BURAYA ROTALARINI (app.get, app.post) EKLEYEBİLİRSİN ---

app.get('/', (req, res) => {
    // Örnek olarak ana sayfayı render edelim veya mesaj gönderelim
    res.send('StudyAI: AI Fundamentals Edition for FAU Students is Running!');
});

// ---------------------------------------------------------

// 4. Hata Yakalayıcı (En sonda olmalı)
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Hata sayfası render edilirken 'error.ejs' dosyasının varlığından emin ol
    res.status(500).render('error', {
        message: 'Bir şeyler ters gitti!',
        error: err,
        user: null
    });
});

// 5. Vercel için kritik nokta: app.listen KULLANMIYORUZ
module.exports = app;