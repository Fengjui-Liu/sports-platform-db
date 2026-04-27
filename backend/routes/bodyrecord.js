const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// 新增身體數據
router.post('/', async (req, res) => {
  const { weight, height, body_fat, recorded_at } = req.body;
  const userId = req.params.id;

  if (weight === undefined || height === undefined || body_fat === undefined) {
    return res.status(400).json({ error: 'weight、height、body_fat 為必填欄位' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO BODYRECORD (user_id, weight, height, body_fat, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, weight, height, body_fat, recorded_at || new Date()]
    );

    res.json({
      message: '新增身體數據成功',
      record_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 查詢指定使用者的身體數據
router.get('/', async (req, res) => {
  const userId = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT record_id, user_id, weight, height, body_fat, recorded_at
       FROM BODYRECORD
       WHERE user_id = ?
       ORDER BY recorded_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
