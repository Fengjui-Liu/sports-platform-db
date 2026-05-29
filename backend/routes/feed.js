const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

router.get('/', async (req, res) => {
  const viewerId = req.query.viewer_id ? parseId(req.query.viewer_id) : null;
  const followingOnly = req.query.following === '1';
  const followerId = req.query.user_id ? parseId(req.query.user_id) : null;

  if (req.query.viewer_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 viewer_id' });
  }
  if (req.query.user_id && Number.isNaN(followerId)) {
    return res.status(400).json({ error: '無效的 user_id' });
  }
  if (followingOnly && !followerId) {
    return res.status(400).json({ error: '追蹤動態需提供 user_id' });
  }

  const followJoinPost = followingOnly
    ? `JOIN USERFOLLOW _f ON _f.followee_id = p.user_id AND _f.follower_id = ${db.escape(followerId)}`
    : '';

  const followJoinInv = followingOnly
    ? `JOIN USERFOLLOW _f ON _f.followee_id = i.user_id AND _f.follower_id = ${db.escape(followerId)}`
    : '';

  try {
    const [rows] = await db.query(
      `(
        SELECT
          'post'               AS type,
          p.post_id            AS item_id,
          p.user_id,
          p.board_id,
          p.title,
          p.content,
          p.image_url,
          p.created_at,
          u.username,
          u.profile_image,
          b.sport_type         AS board_name,
          COUNT(DISTINCT l.user_id)                                            AS like_count,
          COUNT(DISTINCT c.comment_id)                                         AS comment_count,
          MAX(CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END)                 AS liked_by_viewer,
          MAX(CASE WHEN pb.user_id IS NULL THEN 0 ELSE 1 END)                 AS bookmarked_by_viewer,
          NULL                 AS location,
          NULL                 AS event_time,
          0                    AS max_participants,
          0                    AS participant_count
        FROM POST p
        JOIN USER u ON u.user_id = p.user_id
        JOIN SPORTBOARD b ON b.board_id = p.board_id
        ${followJoinPost}
        LEFT JOIN POSTLIKE l        ON l.post_id  = p.post_id
        LEFT JOIN COMMENT  c        ON c.post_id  = p.post_id
        LEFT JOIN POSTLIKE pl       ON pl.post_id = p.post_id AND pl.user_id = ?
        LEFT JOIN POSTBOOKMARK pb   ON pb.post_id = p.post_id AND pb.user_id = ?
        GROUP BY p.post_id, p.user_id, p.board_id, p.title, p.content,
                 p.image_url, p.created_at, u.username, u.profile_image, b.sport_type
      )
      UNION ALL
      (
        SELECT
          'invitation'         AS type,
          i.invitation_id      AS item_id,
          i.user_id,
          i.board_id,
          i.title,
          NULL                 AS content,
          NULL                 AS image_url,
          i.created_at,
          u.username,
          u.profile_image,
          b.sport_type         AS board_name,
          0                    AS like_count,
          0                    AS comment_count,
          0                    AS liked_by_viewer,
          0                    AS bookmarked_by_viewer,
          i.location,
          i.event_time,
          i.max_participants,
          COUNT(DISTINCT ip.user_id) AS participant_count
        FROM WORKOUTINVITATION i
        JOIN USER u ON u.user_id = i.user_id
        JOIN SPORTBOARD b ON b.board_id = i.board_id
        ${followJoinInv}
        LEFT JOIN INVITATIONPARTICIPANT ip ON ip.invitation_id = i.invitation_id
        GROUP BY i.invitation_id, i.user_id, i.board_id, i.title,
                 i.created_at, u.username, u.profile_image, b.sport_type,
                 i.location, i.event_time, i.max_participants
      )
      ORDER BY created_at DESC, item_id DESC
      LIMIT 80`,
      [viewerId, viewerId]
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
