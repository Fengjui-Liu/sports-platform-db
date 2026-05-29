const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

const normalizeDifficultyLevel = (value) => {
  const difficultyMap = {
    easy: 'easy',
    medium: 'medium',
    hard: 'hard',
    beginner: 'easy',
    intermediate: 'medium',
    advanced: 'hard',
    '初級': 'easy',
    '中級': 'medium',
    '高級': 'hard',
    '簡單': 'easy',
    '普通': 'medium',
    '困難': 'hard',
  };

  return difficultyMap[String(value).trim().toLowerCase()];
};

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, [
    'user_id',
    'title',
    'sport_type',
    'difficulty_level',
    'exercise_name',
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
    muscle_group = '',
    reps = 0,
    sets = 0,
  } = req.body;

  const normalizedDifficultyLevel = normalizeDifficultyLevel(difficulty_level);

  if (!normalizedDifficultyLevel) {
    return res.status(400).json({
      error: 'Invalid difficulty_level. Use easy, medium, hard, 初級, 中級, or 高級.',
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO WORKOUTPLAN (
         user_id, title, is_public, sport_type, difficulty_level,
         exercise_name, muscle_group, reps, \`sets\`, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user_id,
        title,
        is_public,
        sport_type,
        normalizedDifficultyLevel,
        exercise_name,
        muscle_group,
        reps,
        sets,
      ]
    );

    res.status(201).json({
      message: '建立訓練計畫成功',
      plan_id: result.insertId,
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/', async (req, res) => {
  const userId = req.query.user_id ? parseId(req.query.user_id) : null;
  const viewerId = req.query.viewer_id ? parseId(req.query.viewer_id) : null;

  if (req.query.user_id && Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (req.query.viewer_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 viewer id' });
  }

  try {
    const params = [viewerId];
    let whereClause = 'WHERE w.is_public = TRUE';

    // 如果有帶 user_id，代表要看某個使用者建立的計畫
    if (userId) {
      whereClause = 'WHERE w.user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.query(
      `SELECT w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
              w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at,
              u.username,
              COUNT(DISTINCT s.user_id) AS save_count,
              MAX(CASE WHEN ws.user_id IS NULL THEN 0 ELSE 1 END) AS saved_by_viewer
       FROM WORKOUTPLAN w
       JOIN USER u ON u.user_id = w.user_id
       LEFT JOIN WORKOUTPLANSAVE s ON s.plan_id = w.plan_id
       LEFT JOIN WORKOUTPLANSAVE ws ON ws.plan_id = w.plan_id AND ws.user_id = ?
       ${whereClause}
       GROUP BY w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
                w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at, u.username
       ORDER BY w.created_at DESC, w.plan_id DESC`,
      params
    );

    res.json(rows.map((row) => ({
      ...row,
      saved_by_viewer: Number(row.saved_by_viewer),
      isFavoritedByMe: Boolean(Number(row.saved_by_viewer)),
      save_count: Number(row.save_count),
      favoriteCount: Number(row.save_count),
    })));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const planId = parseId(req.params.id);
  const viewerId = req.query.user_id ? parseId(req.query.user_id) : null;

  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  if (req.query.user_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
              w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at,
              u.username, u.profile_image,
              COUNT(DISTINCT s.user_id) AS save_count,
              MAX(CASE WHEN ws.user_id IS NULL THEN 0 ELSE 1 END) AS saved_by_viewer
       FROM WORKOUTPLAN w
       JOIN USER u ON u.user_id = w.user_id
       LEFT JOIN WORKOUTPLANSAVE s ON s.plan_id = w.plan_id
       LEFT JOIN WORKOUTPLANSAVE ws ON ws.plan_id = w.plan_id AND ws.user_id = ?
       WHERE w.plan_id = ?
       GROUP BY w.plan_id, w.user_id, w.title, w.is_public, w.sport_type, w.difficulty_level,
                w.exercise_name, w.muscle_group, w.reps, w.\`sets\`, w.created_at,
                u.username, u.profile_image`,
      [viewerId, planId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }

    const plan = rows[0];
    res.json({
      ...plan,
      saved_by_viewer: Number(plan.saved_by_viewer),
      isFavoritedByMe: Boolean(Number(plan.saved_by_viewer)),
      save_count: Number(plan.save_count),
      favoriteCount: Number(plan.save_count),
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.put('/:id', async (req, res) => {
  const planId = parseId(req.params.id);

  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  if (!ensureRequired(res, req.body, [
    'user_id',
    'title',
    'is_public',
    'sport_type',
    'difficulty_level',
    'exercise_name',
    'sets',
    'reps',
  ])) {
    return;
  }

  const {
    user_id,
    title,
    is_public,
    sport_type,
    difficulty_level,
    exercise_name,
    muscle_group = '',
    sets,
    reps,
  } = req.body;

  const normalizedDifficultyLevel = normalizeDifficultyLevel(difficulty_level);

  if (!normalizedDifficultyLevel) {
    return res.status(400).json({
      error: 'Invalid difficulty_level. Use easy, medium, hard, 初級, 中級, or 高級.',
    });
  }

  try {
    const [[plan]] = await db.query(
      'SELECT user_id FROM WORKOUTPLAN WHERE plan_id = ?',
      [planId]
    );

    if (!plan) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }

    if (Number(plan.user_id) !== Number(user_id)) {
      return res.status(403).json({ error: '只能修改自己的訓練計畫' });
    }

    await db.query(
      `UPDATE WORKOUTPLAN
       SET title = ?, is_public = ?, sport_type = ?, difficulty_level = ?,
           exercise_name = ?, muscle_group = ?, \`sets\` = ?, reps = ?
       WHERE plan_id = ?`,
      [
        title,
        is_public,
        sport_type,
        normalizedDifficultyLevel,
        exercise_name,
        muscle_group,
        sets,
        reps,
        planId,
      ]
    );

    res.json({ message: '修改訓練計畫成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  const planId = parseId(req.params.id);

  if (Number.isNaN(planId)) {
    return res.status(400).json({ error: '無效的 plan id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    const [[plan]] = await db.query(
      'SELECT user_id FROM WORKOUTPLAN WHERE plan_id = ?',
      [planId]
    );

    if (!plan) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }

    if (Number(plan.user_id) !== Number(req.body.user_id)) {
      return res.status(403).json({ error: '只能刪除自己的訓練計畫' });
    }

    const [result] = await db.query(
      'DELETE FROM WORKOUTPLAN WHERE plan_id = ?',
      [planId]
    );

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
    const [[plan]] = await db.query(
      'SELECT plan_id FROM WORKOUTPLAN WHERE plan_id = ?',
      [planId]
    );

    if (!plan) {
      return res.status(404).json({ error: '找不到訓練計畫' });
    }

    await db.query(
      `INSERT INTO WORKOUTPLANSAVE (plan_id, user_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
      [planId, req.body.user_id]
    );

    const [[state]] = await db.query(
      `SELECT
         COUNT(*) AS save_count,
         EXISTS(
           SELECT 1
           FROM WORKOUTPLANSAVE
           WHERE plan_id = ? AND user_id = ?
         ) AS saved_by_viewer
       FROM WORKOUTPLANSAVE
       WHERE plan_id = ?`,
      [planId, req.body.user_id, planId]
    );

    res.json({
      message: '收藏計畫成功',
      saved_by_viewer: Number(state.saved_by_viewer),
      isFavoritedByMe: Boolean(Number(state.saved_by_viewer)),
      save_count: Number(state.save_count),
      favoriteCount: Number(state.save_count),
    });
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
    await db.query(
      'DELETE FROM WORKOUTPLANSAVE WHERE plan_id = ? AND user_id = ?',
      [planId, req.body.user_id]
    );

    const [[state]] = await db.query(
      `SELECT
         COUNT(*) AS save_count,
         EXISTS(
           SELECT 1
           FROM WORKOUTPLANSAVE
           WHERE plan_id = ? AND user_id = ?
         ) AS saved_by_viewer
       FROM WORKOUTPLANSAVE
       WHERE plan_id = ?`,
      [planId, req.body.user_id, planId]
    );

    res.json({
      message: '取消收藏成功',
      saved_by_viewer: Number(state.saved_by_viewer),
      isFavoritedByMe: Boolean(Number(state.saved_by_viewer)),
      save_count: Number(state.save_count),
      favoriteCount: Number(state.save_count),
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
