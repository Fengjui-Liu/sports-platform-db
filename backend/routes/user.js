const express = require('express');
const router = express.Router();
const db = require('../db');

// 註冊
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO USER (username, password, email) VALUES (?, ?, ?)',
      [username, password, email]
    );
    res.json({ message: '註冊成功', user_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 登入
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, email FROM USER WHERE username = ? AND password = ?',
      [username, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: '帳號或密碼錯誤' });
    res.json({ message: '登入成功', user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 修改個人資料
router.put('/:id', async (req, res) => {
  const { bio, profile_image } = req.body;
  try {
    await db.query(
      'UPDATE USER SET bio = ?, profile_image = ? WHERE user_id = ?',
      [bio, profile_image, req.params.id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
