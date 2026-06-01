const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

const POST_FEED_SELECT = `
  SELECT
    'post'               AS type,
    p.post_id            AS item_id,
    p.post_id            AS id,
    p.user_id,
    p.board_id,
    p.title,
    p.content,
    p.image_url,
    p.created_at,
    p.created_at         AS createdAt,
    p.updated_at,
    p.updated_at         AS updatedAt,
    u.username,
    u.username           AS authorName,
    u.profile_image,
    b.sport_type         AS board_name,
    b.sport_type         AS boardName,
    b.sport_type         AS sportType,
    COUNT(DISTINCT l.user_id)                           AS like_count,
    COUNT(DISTINCT l.user_id)                           AS likeCount,
    COUNT(DISTINCT c.comment_id)                        AS comment_count,
    COUNT(DISTINCT c.comment_id)                        AS commentCount,
    MAX(CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END) AS liked_by_viewer,
    MAX(CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END) AS isLikedByMe,
    MAX(CASE WHEN pb.user_id IS NULL THEN 0 ELSE 1 END) AS bookmarked_by_viewer,
    MAX(CASE WHEN pb.user_id IS NULL THEN 0 ELSE 1 END) AS isSavedByMe,
    NULL                 AS location,
    NULL                 AS event_time,
    0                    AS max_participants,
    0                    AS participant_count
  FROM POST p
  JOIN USER u ON u.user_id = p.user_id
  JOIN SPORTBOARD b ON b.board_id = p.board_id
  %%FOLLOW_JOIN%%
  LEFT JOIN POSTLIKE l      ON l.post_id = p.post_id
  LEFT JOIN COMMENT c       ON c.post_id = p.post_id
  LEFT JOIN POSTLIKE pl     ON pl.post_id = p.post_id AND pl.user_id = ?
  LEFT JOIN POSTBOOKMARK pb ON pb.post_id = p.post_id AND pb.user_id = ?
  %%WHERE_CLAUSE%%
  GROUP BY p.post_id, p.user_id, p.board_id, p.title, p.content,
           p.image_url, p.created_at, p.updated_at, u.username, u.profile_image, b.sport_type
`;

// Invitation SELECT — no viewer-specific fields (liked/bookmarked hardcoded 0).
// %%FOLLOW_JOIN%% is replaced with either a USERFOLLOW join or empty string.
const INVITATION_FEED_SELECT = `
  SELECT
    'invitation'         AS type,
    i.invitation_id      AS item_id,
    i.invitation_id      AS id,
    i.user_id,
    i.board_id,
    i.title,
    NULL                 AS content,
    NULL                 AS image_url,
    i.created_at,
    i.created_at         AS createdAt,
    NULL                 AS updated_at,
    NULL                 AS updatedAt,
    u.username,
    u.username           AS authorName,
    u.profile_image,
    b.sport_type         AS board_name,
    b.sport_type         AS boardName,
    b.sport_type         AS sportType,
    0                    AS like_count,
    0                    AS likeCount,
    0                    AS comment_count,
    0                    AS commentCount,
    0                    AS liked_by_viewer,
    0                    AS isLikedByMe,
    0                    AS bookmarked_by_viewer,
    0                    AS isSavedByMe,
    i.location,
    i.event_time,
    i.max_participants,
    COUNT(DISTINCT CASE WHEN ip.status = 'confirmed' THEN ip.user_id END) AS participant_count
  FROM WORKOUTINVITATION i
  JOIN USER u ON u.user_id = i.user_id
  JOIN SPORTBOARD b ON b.board_id = i.board_id
  %%FOLLOW_JOIN%%
  LEFT JOIN INVITATIONPARTICIPANT ip ON ip.invitation_id = i.invitation_id
  WHERE i.event_time > NOW()
  GROUP BY i.invitation_id, i.user_id, i.board_id, i.title,
           i.created_at, u.username, u.profile_image, b.sport_type,
           i.location, i.event_time, i.max_participants
`;

function buildPostFeedQuery({ follow = false, where = '' } = {}) {
  return POST_FEED_SELECT
    .replace(
      '%%FOLLOW_JOIN%%',
      follow ? 'JOIN USERFOLLOW _f ON _f.followee_id = p.user_id AND _f.follower_id = ?' : ''
    )
    .replace('%%WHERE_CLAUSE%%', where);
}

function buildInvitationFeedQuery({ follow = false } = {}) {
  return INVITATION_FEED_SELECT.replace(
    '%%FOLLOW_JOIN%%',
    follow ? 'JOIN USERFOLLOW _f ON _f.followee_id = i.user_id AND _f.follower_id = ?' : ''
  );
}

router.get('/', async (req, res) => {
  const viewerId = req.query.viewer_id ? parseId(req.query.viewer_id) : null;
  const requestedMode = req.query.mode || (req.query.following === '1' ? 'following' : 'hot');
  const mode = ['hot', 'latest', 'following'].includes(requestedMode) ? requestedMode : 'hot';
  const followerId = req.query.user_id ? parseId(req.query.user_id) : viewerId;

  if (req.query.viewer_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: 'invalid viewer_id' });
  }

  if (req.query.user_id && Number.isNaN(followerId)) {
    return res.status(400).json({ error: 'invalid user_id' });
  }

  if (mode === 'following' && !followerId) {
    return res.status(400).json({ error: 'following feed requires user_id' });
  }

  try {
    if (mode === 'hot') {
      const [rows] = await db.query(
        `(${buildPostFeedQuery()})
         UNION ALL
         (${buildInvitationFeedQuery()})
         ORDER BY
           CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY) THEN 0 ELSE 1 END,
           like_count DESC,
           created_at DESC,
           item_id DESC`,
        [viewerId, viewerId]
      );

      return res.json(rows);
    }

    if (mode === 'latest') {
      const [rows] = await db.query(
        `(${buildPostFeedQuery()})
         UNION ALL
         (${buildInvitationFeedQuery()})
         ORDER BY created_at DESC, item_id DESC
         LIMIT 80`,
        [viewerId, viewerId]
      );

      return res.json(rows);
    }

    // following mode — filter both posts and invitations to followed users only
    const [rows] = await db.query(
      `(${buildPostFeedQuery({ follow: true })})
       UNION ALL
       (${buildInvitationFeedQuery({ follow: true })})
       ORDER BY created_at DESC, item_id DESC
       LIMIT 80`,
      [followerId, viewerId, viewerId, followerId]
    );

    return res.json(rows);
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
