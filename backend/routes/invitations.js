const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, [
    'user_id',
    'board_id',
    'title',
    'location',
    'event_time',
    'max_participants',
  ])) {
    return;
  }

  const {
    user_id,
    board_id,
    title,
    location,
    event_time,
    max_participants,
  } = req.body;

  try {
    const [[board]] = await db.query(
      'SELECT board_id FROM SPORTBOARD WHERE board_id = ?',
      [board_id]
    );

    if (!board) {
      return res.status(404).json({ error: '找不到指定的專欄' });
    }

    const [result] = await db.query(
      `INSERT INTO WORKOUTINVITATION (
         user_id, board_id, title, location, event_time, max_participants, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, board_id, title, location, event_time, max_participants]
    );

    res.status(201).json({
      message: '建立揪團成功',
      invitation_id: result.insertId,
      board_id,
    });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/', async (req, res) => {
  const viewerId = req.query.user_id ? parseId(req.query.user_id) : null;
  const ownerId = req.query.owner_id ? parseId(req.query.owner_id) : null;
  const participantUserId = req.query.participant_user_id
    ? parseId(req.query.participant_user_id)
    : null;

  if (req.query.user_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (req.query.owner_id && Number.isNaN(ownerId)) {
    return res.status(400).json({ error: '無效的 owner id' });
  }

  if (req.query.participant_user_id && Number.isNaN(participantUserId)) {
    return res.status(400).json({ error: '無效的 participant user id' });
  }

  const boardId = req.query.board_id ? parseId(req.query.board_id) : null;

  if (req.query.board_id && Number.isNaN(boardId)) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  try {
    const whereParts = [];
    const params = [viewerId];

    if (boardId) {
      whereParts.push('i.board_id = ?');
      params.push(boardId);
    }

    if (ownerId) {
      whereParts.push('i.user_id = ?');
      params.push(ownerId);
    }

    if (participantUserId) {
      whereParts.push(
        `EXISTS (
          SELECT 1
          FROM INVITATIONPARTICIPANT ip
          WHERE ip.invitation_id = i.invitation_id
            AND ip.user_id = ?
        )`
      );
      params.push(participantUserId);
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(' AND ')}`
      : '';

    const [rows] = await db.query(
      `SELECT i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
              i.max_participants, i.created_at,
              u.username,
              b.sport_type AS board_name,
              COUNT(DISTINCT p.user_id) AS participant_count,
              MAX(CASE WHEN vp.user_id IS NULL THEN 0 ELSE 1 END) AS joined_by_viewer
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       LEFT JOIN INVITATIONPARTICIPANT vp ON vp.invitation_id = i.invitation_id AND vp.user_id = ?
       ${whereClause}
       GROUP BY i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
                i.max_participants, i.created_at, u.username, b.sport_type
       ORDER BY i.event_time ASC, i.invitation_id DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.post('/:id/join', async (req, res) => {
  const invitationId = parseId(req.params.id);

  if (Number.isNaN(invitationId)) {
    return res.status(400).json({ error: '無效的 invitation id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  const userId = req.body.user_id;

  try {
    const [rows] = await db.query(
      `SELECT i.max_participants, COUNT(p.user_id) AS participant_count
       FROM WORKOUTINVITATION i
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       WHERE i.invitation_id = ?
       GROUP BY i.invitation_id, i.max_participants`,
      [invitationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(rows[0].participant_count) >= Number(rows[0].max_participants)) {
      return res.status(400).json({ error: '揪團名額已滿' });
    }

    await db.query(
      `INSERT INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at)`,
      [invitationId, userId]
    );

    res.json({ message: '加入揪團成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  const invitationId = parseId(req.params.id);

  if (Number.isNaN(invitationId)) {
    return res.status(400).json({ error: '無效的 invitation id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    const [[invitation]] = await db.query(
      'SELECT user_id FROM WORKOUTINVITATION WHERE invitation_id = ?',
      [invitationId]
    );

    if (!invitation) {
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(invitation.user_id) !== Number(req.body.user_id)) {
      return res.status(403).json({ error: '只有發起人可以取消揪團' });
    }

    await db.query('DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ?', [invitationId]);
    await db.query('DELETE FROM WORKOUTINVITATION WHERE invitation_id = ?', [invitationId]);

    res.json({ message: '取消揪團成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id/join', async (req, res) => {
  const invitationId = parseId(req.params.id);

  if (Number.isNaN(invitationId)) {
    return res.status(400).json({ error: '無效的 invitation id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query(
      'DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ? AND user_id = ?',
      [invitationId, req.body.user_id]
    );

    res.json({ message: '退出揪團成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;