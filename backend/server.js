const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const userRoutes = require('./routes/user');
const bodyRecordRoutes = require('./routes/bodyrecord');
app.use('/api/users', userRoutes);
app.use('/api/users/:id/bodyrecord', bodyRecordRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
