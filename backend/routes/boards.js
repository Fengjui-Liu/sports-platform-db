const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    let [rows] = await db.query(
      `SELECT 
          b.board_id,
          b.sport_type,
          b.description,
          b.created_at,
          COALESCE(pc.post_count, 0) AS post_count,
          COALESCE(wc.plan_count, 0) AS plan_count,
          COALESCE(ic.invitation_count, 0) AS invitation_count
       FROM SPORTBOARD b
       LEFT JOIN (
          SELECT board_id, COUNT(*) AS post_count
          FROM POST
          GROUP BY board_id
       ) pc ON pc.board_id = b.board_id
       LEFT JOIN (
          SELECT board_id, COUNT(*) AS plan_count
          FROM WORKOUTPLAN
          GROUP BY board_id
       ) wc ON wc.board_id = b.board_id
       LEFT JOIN (
          SELECT board_id, COUNT(*) AS invitation_count
          FROM WORKOUTINVITATION
          GROUP BY board_id
       ) ic ON ic.board_id = b.board_id
       ORDER BY b.created_at DESC, b.board_id DESC`
    );

    if (rows.length === 0) {
      await db.query(
        `INSERT INTO SPORTBOARD (sport_type, description, created_at)
         VALUES (?, ?, NOW())`,
        ['籃球', '籃球交流、訓練心得、比賽討論專欄']
      );

      [rows] = await db.query(
        `SELECT 
            b.board_id,
            b.sport_type,
            b.description,
            b.created_at,
            COALESCE(pc.post_count, 0) AS post_count,
            COALESCE(wc.plan_count, 0) AS plan_count,
            COALESCE(ic.invitation_count, 0) AS invitation_count
         FROM SPORTBOARD b
         LEFT JOIN (
            SELECT board_id, COUNT(*) AS post_count
            FROM POST
            GROUP BY board_id
         ) pc ON pc.board_id = b.board_id
         LEFT JOIN (
            SELECT board_id, COUNT(*) AS plan_count
            FROM WORKOUTPLAN
            GROUP BY board_id
         ) wc ON wc.board_id = b.board_id
         LEFT JOIN (
            SELECT board_id, COUNT(*) AS invitation_count
            FROM WORKOUTINVITATION
            GROUP BY board_id
         ) ic ON ic.board_id = b.board_id
         ORDER BY b.created_at DESC, b.board_id DESC`
      );
    }

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/', async (req, res) => {
  const { sport_type, description = '' } = req.body;

  if (!sport_type || !sport_type.trim()) {
    return res.status(400).json({ error: '請輸入專欄名稱' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO SPORTBOARD (sport_type, description, created_at)
       VALUES (?, ?, NOW())`,
      [sport_type.trim(), description.trim()]
    );

    res.status(201).json({
      message: '新增專欄成功',
      board_id: result.insertId,
      sport_type: sport_type.trim(),
      description: description.trim(),
      post_count: 0,
      plan_count: 0,
      invitation_count: 0,
    });
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
    const [[board]] = await db.query(
      'SELECT board_id FROM SPORTBOARD WHERE board_id = ?',
      [boardId]
    );

    if (!board) {
      return res.status(404).json({ error: '找不到專欄' });
    }

    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.post_type, p.title, p.content, p.image_url, p.created_at,
              u.username, u.profile_image,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count
       FROM POST p
       JOIN USER u ON u.user_id = p.user_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       WHERE p.board_id = ?
       GROUP BY p.post_id, p.user_id, p.board_id, p.post_type, p.title, p.content, p.image_url, p.created_at,
                u.username, u.profile_image
       ORDER BY p.created_at DESC, p.post_id DESC`,
      [boardId]
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;