const express = require('express');
const router = express.Router();
const db = require('../db');
const bodyRecordRoutes = require('./bodyrecord');
const { ensureRequired, parseId, sendServerError } = require('./utils');

router.use('/:id/bodyrecord', bodyRecordRoutes);

// 註冊
router.post('/register', async (req, res) => {
  if (!ensureRequired(res, req.body, ['username', 'password', 'email'])) {
    return;
  }

  const { username, password, email } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO USER (username, password, email) VALUES (?, ?, ?)',
      [username, password, email]
    );
    res.status(201).json({ message: '註冊成功', user_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

// 登入
router.post('/login', async (req, res) => {
  if (!ensureRequired(res, req.body, ['username', 'password'])) {
    return;
  }

  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, email, bio, profile_image FROM USER WHERE username = ? AND password = ?',
      [username, password]
    );
    if (rows.length === 0) return res.status(401).json({ error: '帳號或密碼錯誤' });
    res.json({ message: '登入成功', user: rows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const userId = parseId(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [[userRows], [statsRows]] = await Promise.all([
      db.query(
        `SELECT user_id, username, email, bio, profile_image
         FROM USER
         WHERE user_id = ?`,
        [userId]
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM POST WHERE user_id = ?) AS post_count,
           (SELECT COUNT(*) FROM WORKOUTSESSION WHERE user_id = ?) AS session_count,
           (SELECT COUNT(*) FROM WORKOUTPLANSAVE WHERE user_id = ?) AS saved_plan_count,
           (SELECT COUNT(*) FROM USERFOLLOW WHERE followee_id = ?) AS follower_count,
           (SELECT COUNT(*) FROM USERFOLLOW WHERE follower_id = ?) AS following_count`,
        [userId, userId, userId, userId, userId]
      ),
    ]);

    if (userRows.length === 0) {
      return res.status(404).json({ error: '找不到使用者' });
    }

    res.json({ ...userRows[0], ...statsRows[0] });
  } catch (err) {
    sendServerError(res, err);
  }
});

// 修改個人資料
router.put('/:id', async (req, res) => {
  const userId = parseId(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  const { bio, profile_image } = req.body;
  try {
    await db.query(
      'UPDATE USER SET bio = ?, profile_image = ? WHERE user_id = ?',
      [bio || '', profile_image || '', userId]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/:id/follow', async (req, res) => {
  const followeeId = parseId(req.params.id);
  if (Number.isNaN(followeeId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (!ensureRequired(res, req.body, ['follower_id'])) {
    return;
  }

  if (Number(req.body.follower_id) === followeeId) {
    return res.status(400).json({ error: '不能追蹤自己' });
  }

  try {
    await db.query(
      `INSERT INTO USERFOLLOW (followee_id, follower_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
      [followeeId, req.body.follower_id]
    );
    res.json({ message: '追蹤成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id/follow', async (req, res) => {
  const followeeId = parseId(req.params.id);
  if (Number.isNaN(followeeId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (!ensureRequired(res, req.body, ['follower_id'])) {
    return;
  }

  try {
    await db.query('DELETE FROM USERFOLLOW WHERE followee_id = ? AND follower_id = ?', [
      followeeId,
      req.body.follower_id,
    ]);
    res.json({ message: '取消追蹤成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/posts', async (req, res) => {
  const userId = parseId(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.post_id, p.board_id, p.post_type, p.content, p.image_url, p.created_at,
              b.sport_type AS board_name,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count
       FROM POST p
       JOIN SPORTBOARD b ON b.board_id = p.board_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       WHERE p.user_id = ?
       GROUP BY p.post_id
       ORDER BY p.created_at DESC, p.post_id DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/saved-plans', async (req, res) => {
  const userId = parseId(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT w.plan_id, w.title, w.sport_type, w.difficulty_level, w.exercise_name,
              w.muscle_group, w.reps, w.\`sets\`, w.created_at, u.username
       FROM WORKOUTPLANSAVE s
       JOIN WORKOUTPLAN w ON w.plan_id = s.plan_id
       JOIN USER u ON u.user_id = w.user_id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC, w.plan_id DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
