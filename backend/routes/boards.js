const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT board_id, sport_type, description, created_at
       FROM SPORTBOARD
       ORDER BY created_at DESC, board_id DESC`
    );
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id/posts', async (req, res) => {
  const boardId = parseId(req.params.id);
  if (Number.isNaN(boardId)) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.post_type, p.content, p.image_url, p.created_at,
              u.username, u.profile_image,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count
       FROM POST p
       JOIN USER u ON u.user_id = p.user_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       WHERE p.board_id = ?
       GROUP BY p.post_id
       ORDER BY p.created_at DESC, p.post_id DESC`,
      [boardId]
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
