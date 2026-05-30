const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

const DEFAULT_BOARDS = [
  ['羽球', '羽球交流、訓練心得、比賽討論專欄'],
  ['籃球', '籃球交流、訓練心得、比賽討論專欄'],
];

function normalizeBoardPayload(body = {}) {
  const name = String(body.name ?? body.sport_type ?? '').trim();
  const description = String(body.description ?? '').trim()
    || (name ? `${name}交流、訓練心得、比賽討論專欄` : '');

  return { name, description };
}

async function fetchBoards() {
  const [rows] = await db.query(
    `SELECT
        b.board_id,
        b.sport_type,
        b.sport_type AS name,
        b.description,
        b.created_at,
        COUNT(DISTINCT p.post_id) AS post_count,
        COUNT(DISTINCT w.plan_id) AS plan_count,
        COUNT(DISTINCT i.invitation_id) AS invitation_count
     FROM SPORTBOARD b
     LEFT JOIN POST p ON p.board_id = b.board_id
     LEFT JOIN WORKOUTPLAN w ON w.sport_type = b.sport_type
     LEFT JOIN WORKOUTINVITATION i ON i.board_id = b.board_id
     GROUP BY b.board_id, b.sport_type, b.description, b.created_at
     ORDER BY b.created_at ASC, b.board_id ASC`
  );

  return rows;
}

async function seedDefaultBoardsIfEmpty() {
  const [[state]] = await db.query('SELECT COUNT(*) AS board_count FROM SPORTBOARD');
  if (Number(state.board_count) > 0) return;

  await db.query(
    `INSERT INTO SPORTBOARD (sport_type, description, created_at)
     VALUES ${DEFAULT_BOARDS.map(() => '(?, ?, NOW())').join(', ')}`,
    DEFAULT_BOARDS.flat()
  );
}

// Get all sport boards with content counts.
router.get('/', async (_req, res) => {
  try {
    await seedDefaultBoardsIfEmpty();
    res.json(await fetchBoards());
  } catch (err) {
    sendServerError(res, err);
  }
});

// Create a new sport board.
router.post('/', async (req, res) => {
  const { name, description } = normalizeBoardPayload(req.body);

  if (!name) {
    return res.status(400).json({ error: '請輸入專欄名稱' });
  }

  try {
    const [[existingBoard]] = await db.query(
      'SELECT board_id FROM SPORTBOARD WHERE sport_type = ? LIMIT 1',
      [name]
    );

    if (existingBoard) {
      return res.status(409).json({ error: '此專欄已存在' });
    }

    const [result] = await db.query(
      `INSERT INTO SPORTBOARD (sport_type, description, created_at)
       VALUES (?, ?, NOW())`,
      [name, description]
    );

    const [[createdBoard]] = await db.query(
      `SELECT
          b.board_id,
          b.sport_type,
          b.sport_type AS name,
          b.description,
          b.created_at,
          0 AS post_count,
          0 AS plan_count,
          0 AS invitation_count
       FROM SPORTBOARD b
       WHERE b.board_id = ?`,
      [result.insertId]
    );

    res.status(201).json(createdBoard);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '此專欄已存在' });
    }
    sendServerError(res, err);
  }
});

// Get posts for a sport board.
router.get('/:id/posts', async (req, res) => {
  const boardId = parseId(req.params.id);
  const viewerId = req.query.viewer_id ? parseId(req.query.viewer_id) : null;

  if (Number.isNaN(boardId)) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  if (req.query.viewer_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 viewer id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT p.post_id, p.user_id, p.board_id, p.title, p.post_type, p.content, p.image_url, p.created_at,
              u.username, u.profile_image,
              COUNT(DISTINCT l.user_id) AS like_count,
              COUNT(DISTINCT c.comment_id) AS comment_count,
              MAX(CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END) AS liked_by_viewer,
              MAX(CASE WHEN pb.user_id IS NULL THEN 0 ELSE 1 END) AS bookmarked_by_viewer
       FROM POST p
       JOIN USER u ON u.user_id = p.user_id
       LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
       LEFT JOIN COMMENT c ON c.post_id = p.post_id
       LEFT JOIN POSTLIKE pl ON pl.post_id = p.post_id AND pl.user_id = ?
       LEFT JOIN POSTBOOKMARK pb ON pb.post_id = p.post_id AND pb.user_id = ?
       WHERE p.board_id = ?
       GROUP BY p.post_id
       ORDER BY p.created_at DESC, p.post_id DESC`,
      [viewerId, viewerId, boardId]
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
