const express = require('express');
const db = require('../db');
const { sendServerError } = require('./utils');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.json({ posts: [], users: [], plans: [] });
  }

  const keyword = `%${q}%`;

  try {
    const [[postsRows], [usersRows], [plansRows]] = await Promise.all([
      db.query(
        `SELECT p.post_id, p.title, p.content, p.created_at, p.updated_at,
                u.user_id, u.username, u.profile_image,
                b.sport_type AS board_name,
                COUNT(DISTINCT l.user_id) AS like_count,
                COUNT(DISTINCT c.comment_id) AS comment_count
         FROM POST p
         JOIN USER u ON u.user_id = p.user_id
         JOIN SPORTBOARD b ON b.board_id = p.board_id
         LEFT JOIN POSTLIKE l ON l.post_id = p.post_id
         LEFT JOIN COMMENT c ON c.post_id = p.post_id
         WHERE p.title LIKE ? OR p.content LIKE ?
         GROUP BY p.post_id
         ORDER BY p.created_at DESC
         LIMIT 20`,
        [keyword, keyword]
      ),
      db.query(
        `SELECT user_id, username, bio, profile_image,
                (SELECT COUNT(*) FROM USERFOLLOW WHERE followee_id = u.user_id) AS follower_count
         FROM USER u
         WHERE username LIKE ?
         LIMIT 20`,
        [keyword]
      ),
      db.query(
        `SELECT w.plan_id, w.title, w.exercise_name, w.sport_type, w.difficulty_level,
                w.sets, w.reps,
                u.user_id, u.username
         FROM WORKOUTPLAN w
         JOIN USER u ON u.user_id = w.user_id
         WHERE w.is_public = TRUE AND (w.title LIKE ? OR w.exercise_name LIKE ?)
         ORDER BY w.created_at DESC
         LIMIT 20`,
        [keyword, keyword]
      ),
    ]);

    res.json({ posts: postsRows, users: usersRows, plans: plansRows });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
