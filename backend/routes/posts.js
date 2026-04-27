const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.query.user_id ? parseId(req.query.user_id) : null;

  if (req.query.user_id && Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const params = [];
    let whereClause = '';

    if (userId) {
      whereClause = 'WHERE p.user_id = ?';
      params.push(userId);
    }

    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.post_type, p.content, p.image_url, p.created_at,
              u.username, u.profile_image, b.sport_type AS board_name,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count
       FROM POST p
       JOIN USER u ON u.user_id = p.user_id
       JOIN SPORTBOARD b ON b.board_id = p.board_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       ${whereClause}
       GROUP BY p.post_id
       ORDER BY p.created_at DESC, p.post_id DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, ['user_id', 'board_id', 'post_type', 'content'])) {
    return;
  }

  const { user_id, board_id, post_type, content, image_url = null } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO POST (user_id, board_id, post_type, content, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [user_id, board_id, post_type, content, image_url]
    );

    res.status(201).json({ message: '建立貼文成功', post_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.post_type, p.content, p.image_url, p.created_at,
              u.username, u.email, u.bio, u.profile_image,
              b.sport_type AS board_name, b.description AS board_description,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count
       FROM POST p
       JOIN USER u ON u.user_id = p.user_id
       JOIN SPORTBOARD b ON b.board_id = p.board_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       WHERE p.post_id = ?
       GROUP BY p.post_id`,
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到貼文' });
    }

    res.json(rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  try {
    const [result] = await db.query('DELETE FROM POST WHERE post_id = ?', [postId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到貼文' });
    }
    res.json({ message: '刪除貼文成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/comments', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at,
              u.username, u.profile_image
       FROM COMMENT c
       JOIN USER u ON u.user_id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC, c.comment_id ASC`,
      [postId]
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/:id/comments', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  if (!ensureRequired(res, req.body, ['user_id', 'content'])) {
    return;
  }

  const { user_id, content } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO COMMENT (user_id, post_id, content, created_at)
       VALUES (?, ?, ?, NOW())`,
      [user_id, postId, content]
    );

    res.status(201).json({ message: '新增留言成功', comment_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/:id/like', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query(
      `INSERT INTO POSTLIKE (post_id, user_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
      [postId, req.body.user_id]
    );

    res.json({ message: '按讚成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id/like', async (req, res) => {
  const postId = parseId(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: '無效的 post id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query('DELETE FROM POSTLIKE WHERE post_id = ? AND user_id = ?', [postId, req.body.user_id]);
    res.json({ message: '取消按讚成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
