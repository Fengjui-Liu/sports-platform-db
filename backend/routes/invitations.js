const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.post('/', async (req, res) => {
  if (!ensureRequired(res, req.body, ['user_id', 'board_id', 'title', 'location', 'event_time', 'max_participants'])) {
    return;
  }

  const { user_id, board_id, title, location, event_time, max_participants } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO WORKOUTINVITATION (user_id, board_id, title, location, event_time, max_participants, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, board_id, title, location, event_time, max_participants]
    );

    res.status(201).json({ message: '建立揪團成功', invitation_id: result.insertId });
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
              i.max_participants, i.created_at, u.username, b.sport_type AS board_name,
              COUNT(DISTINCT p.user_id) AS participant_count
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       GROUP BY i.invitation_id
       ORDER BY i.event_time ASC, i.invitation_id DESC`
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
       GROUP BY i.invitation_id`,
      [invitationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(rows[0].participant_count) >= rows[0].max_participants) {
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

router.delete('/:id/join', async (req, res) => {
  const invitationId = parseId(req.params.id);
  if (Number.isNaN(invitationId)) {
    return res.status(400).json({ error: '無效的 invitation id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    await db.query('DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ? AND user_id = ?', [
      invitationId,
      req.body.user_id,
    ]);
    res.json({ message: '退出揪團成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
