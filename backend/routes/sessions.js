const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, ['user_id', 'plan_id', 'start_time', 'end_time'])) {
    return;
  }

  const { user_id, plan_id, notes = '', start_time, end_time } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO WORKOUTSESSION (user_id, plan_id, notes, start_time, end_time)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, plan_id, notes, start_time, end_time]
    );

    res.status(201).json({ message: '建立訓練紀錄成功', session_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/users/:id/sessions', async (req, res) => {
  const userId = parseId(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT s.session_id, s.user_id, s.plan_id, s.notes, s.start_time, s.end_time,
              w.title, w.exercise_name, w.sport_type, w.difficulty_level
       FROM WORKOUTSESSION s
       LEFT JOIN WORKOUTPLAN w ON w.plan_id = s.plan_id
       WHERE s.user_id = ?
       ORDER BY s.start_time DESC, s.session_id DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
