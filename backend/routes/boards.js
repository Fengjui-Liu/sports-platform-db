const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

// 取得所有專欄，並回傳每個專欄的累積貼文數
router.get('/', async (_req, res) => {
  try {
    let [rows] = await db.query(
      `SELECT 
          b.board_id,
          b.sport_type,
          b.description,
          b.created_at,
          COUNT(p.post_id) AS post_count
       FROM SPORTBOARD b
       LEFT JOIN POST p ON p.board_id = b.board_id
       GROUP BY b.board_id, b.sport_type, b.description, b.created_at
       ORDER BY b.created_at DESC, b.board_id DESC`
    );

    // 如果目前沒有任何專欄，就自動建立一個預設專欄
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
            COUNT(p.post_id) AS post_count
         FROM SPORTBOARD b
         LEFT JOIN POST p ON p.board_id = b.board_id
         GROUP BY b.board_id, b.sport_type, b.description, b.created_at
         ORDER BY b.created_at DESC, b.board_id DESC`
      );
    }

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

// 新增專欄
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
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

// 取得某個專欄底下的貼文
router.get('/:id/posts', async (req, res) => {
  const boardId = parseId(req.params.id);

  if (Number.isNaN(boardId)) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.title, p.post_type, p.content, p.image_url, p.created_at,
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
