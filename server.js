require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;

// Подключение к MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Успешное подключение к MongoDB'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// Настройка сессий и Passport
app.use(express.json());
app.use(session({
  secret: 'super_secret_adpoints_key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Стратегия Google OAuth 2.0
// (Получите CLIENT_ID и CLIENT_SECRET в Google Cloud Console)
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value,
          avatar: profile.photos?.[0]?.value
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Маршруты авторизации Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/'); // После успешного входа перенаправляем на главную
  }
);

app.get('/auth/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// API для получения данных текущего пользователя
app.get('/api/user', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  // Конвертируем Mongoose Map tasksDone в обычный объект для фронтенда
  const userObj = req.user.toObject();
  userObj.tasksDone = Object.fromEntries(req.user.tasksDone || new Map());
  res.json(userObj);
});

// API для начисления баллов и выполнения заданий
app.post('/api/complete-task', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const { taskId, points, label } = req.body;
  try {
    const user = await User.findById(req.user._id);
    
    // Защита от повторного выполнения задания
    if (taskId.startsWith('video') || taskId.startsWith('banner') || taskId === 'survey') {
      if (user.tasksDone.get(taskId)) {
        return res.status(400).json({ error: 'Задание уже выполнено' });
      }
      user.tasksDone.set(taskId, true);
    } else if (taskId === 'daily') {
      const today = new Date().toDateString();
      if (user.lastDaily === today) {
        return res.status(400).json({ error: 'Бонус уже получен сегодня' });
      }
      user.lastDaily = today;
    }

    user.balance += Number(points);
    user.history.push({ label, points: Number(points) });
    await user.save();

    const userObj = user.toObject();
    userObj.tasksDone = Object.fromEntries(user.tasksDone);
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Раздача статических файлов фронтенда
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});