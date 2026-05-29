const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const initDb = require('./initDb');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
const userRoutes = require('./routes/user');
const boardRoutes = require('./routes/boards');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const workoutPlanRoutes = require('./routes/workoutplans');
const sessionRoutes = require('./routes/sessions');
const invitationRoutes = require('./routes/invitations');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');

app.use('/api/users', userRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/workoutplans', workoutPlanRoutes);
app.use('/api', sessionRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB initialization failed:', err.message);
    process.exit(1);
  });
