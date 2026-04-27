const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, [
    'user_id',
    'title',
    'sport_type',
    'difficulty_level',
    'exercise_name',
    'muscle_group',
    'reps',
    'sets',
  ])) {
    return;
  }

  const {
    user_id,
    title,
    is_public = true,
    sport_type,
    difficulty_level,
    exercise_name,
    muscle_group,
    reps,
    sets,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO WORKOUTPLAN (
         user_id, title, is_public, sport_type, difficulty_level,
         exercise_name, muscle_group, reps, \`sets\`, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, title, is_public, sport_type, difficulty_level, exercise_name, muscle_group, reps, sets]
    );

    res.status(201).json({ message: '建立訓練計畫成功', plan_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
              w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at,
              u.username,
              COUNT(DISTINCT s.user_id) AS save_count
       FROM WORKOUTPLAN w
       JOIN USER u ON u.user_id = w.user_id
       LEFT JOIN WORKOUTPLANSAVE s ON s.plan_id = w.plan_id
       WHERE w.is_public = TRUE
       GROUP BY w.plan_id
       ORDER BY w.created_at DESC, w.plan_id DESC`
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const planId = parseId(req.params.id);
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
              w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at,
              u.username, u.profile_image, COUNT(DISTINCT s.user_id) AS save_count
       FROM WORKOUTPLAN w
       JOIN USER u ON u.user_id = w.user_id
       LEFT JOIN WORKOUTPLANSAVE s ON s.plan_id = w.plan_id
       WHERE w.plan_id = ?
       GROUP BY w.plan_id`,
      [planId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }

    res.json(rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  const planId = parseId(req.params.id);
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  try {
    const [result] = await db.query('DELETE FROM WORKOUTPLAN WHERE plan_id = ?', [planId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }
    res.json({ message: '刪除訓練計畫成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/:id/save', async (req, res) => {
  const planId = parseId(req.params.id);
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query(
      `INSERT INTO WORKOUTPLANSAVE (plan_id, user_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
      [planId, req.body.user_id]
    );
    res.json({ message: '收藏計畫成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id/save', async (req, res) => {
  const planId = parseId(req.params.id);
  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query('DELETE FROM WORKOUTPLANSAVE WHERE plan_id = ? AND user_id = ?', [planId, req.body.user_id]);
    res.json({ message: '取消收藏成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
