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

  const userId = Number(user_id);
  const boardId = Number(board_id);
  const maxParticipants = Number(max_participants);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (!Number.isInteger(boardId) || boardId < 1) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  if (!Number.isInteger(maxParticipants) || maxParticipants < 1) {
    return res.status(400).json({ error: '人數上限必須至少為 1' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[board]] = await connection.query(
      'SELECT board_id FROM SPORTBOARD WHERE board_id = ?',
      [boardId]
    );

    if (!board) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到指定的專欄' });
    }

    const [[user]] = await connection.query(
      'SELECT user_id FROM USER WHERE user_id = ?',
      [userId]
    );

    if (!user) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到使用者' });
    }

    const [result] = await connection.query(
      `INSERT INTO WORKOUTINVITATION (
         user_id, board_id, title, location, event_time, max_participants, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        boardId,
        title.trim(),
        location.trim(),
        event_time,
        maxParticipants,
      ]
    );

    const invitationId = result.insertId;

    await connection.query(
      `INSERT INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at)`,
      [invitationId, userId]
    );

    await connection.commit();

    res.status(201).json({
      message: '建立揪團成功',
      invitation_id: invitationId,
      board_id: boardId,
    });
  } catch (err) {
    await connection.rollback();
    sendServerError(res, err);
  } finally {
    connection.release();
  }
});

router.get('/', async (req, res) => {
  const viewerId = req.query.user_id ? parseId(req.query.user_id) : null;
  const ownerId = req.query.owner_id ? parseId(req.query.owner_id) : null;
  const participantUserId = req.query.participant_user_id
    ? parseId(req.query.participant_user_id)
    : null;
  const boardId = req.query.board_id ? parseId(req.query.board_id) : null;

  if (req.query.user_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  if (req.query.owner_id && Number.isNaN(ownerId)) {
    return res.status(400).json({ error: '無效的 owner id' });
  }

  if (req.query.participant_user_id && Number.isNaN(participantUserId)) {
    return res.status(400).json({ error: '無效的 participant user id' });
  }

  if (req.query.board_id && Number.isNaN(boardId)) {
    return res.status(400).json({ error: '無效的 board id' });
  }

  try {
    const whereParts = [];
    const params = [viewerId, viewerId];

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

    if (boardId) {
      whereParts.push('i.board_id = ?');
      params.push(boardId);
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(' AND ')}`
      : '';

    const [rows] = await db.query(
      `SELECT 
          i.invitation_id,
          i.user_id,
          i.board_id,
          i.title,
          i.location,
          i.event_time,
          i.max_participants,
          i.created_at,
          u.username,
          b.sport_type AS board_name,
          COUNT(DISTINCT p.user_id) AS participant_count,
          MAX(CASE WHEN i.user_id = ? THEN 1 ELSE 0 END) AS is_owner,
          MAX(CASE WHEN vp.user_id IS NULL THEN 0 ELSE 1 END) AS joined_by_viewer,
          GROUP_CONCAT(
            DISTINCT pu.username
            ORDER BY pu.username
            SEPARATOR ', '
          ) AS participant_usernames
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       LEFT JOIN USER pu ON pu.user_id = p.user_id
       LEFT JOIN INVITATIONPARTICIPANT vp 
              ON vp.invitation_id = i.invitation_id 
             AND vp.user_id = ?
       ${whereClause}
       GROUP BY 
          i.invitation_id,
          i.user_id,
          i.board_id,
          i.title,
          i.location,
          i.event_time,
          i.max_participants,
          i.created_at,
          u.username,
          b.sport_type
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

  const userId = Number(req.body.user_id);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[invitation]] = await connection.query(
      `SELECT invitation_id, user_id, max_participants
       FROM WORKOUTINVITATION
       WHERE invitation_id = ?
       FOR UPDATE`,
      [invitationId]
    );

    if (!invitation) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    const [[alreadyJoined]] = await connection.query(
      `SELECT user_id
       FROM INVITATIONPARTICIPANT
       WHERE invitation_id = ? AND user_id = ?`,
      [invitationId, userId]
    );

    if (alreadyJoined) {
      await connection.rollback();
      return res.json({ message: '已經在揪團中' });
    }

    const [[countRow]] = await connection.query(
      `SELECT COUNT(*) AS participant_count
       FROM INVITATIONPARTICIPANT
       WHERE invitation_id = ?`,
      [invitationId]
    );

    if (Number(countRow.participant_count) >= Number(invitation.max_participants)) {
      await connection.rollback();
      return res.status(400).json({ error: '揪團名額已滿，無法再加入' });
    }

    await connection.query(
      `INSERT INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at)
       VALUES (?, ?, NOW())`,
      [invitationId, userId]
    );

    await connection.commit();

    res.json({ message: '加入揪團成功' });
  } catch (err) {
    await connection.rollback();
    sendServerError(res, err);
  } finally {
    connection.release();
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

  const userId = Number(req.body.user_id);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [[invitation]] = await db.query(
      `SELECT user_id
       FROM WORKOUTINVITATION
       WHERE invitation_id = ?`,
      [invitationId]
    );

    if (!invitation) {
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(invitation.user_id) === userId) {
      return res.status(400).json({ error: '發起人若要取消活動，請使用取消揪團功能' });
    }

    await db.query(
      'DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ? AND user_id = ?',
      [invitationId, userId]
    );

    res.json({ message: '退出揪團成功' });
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

  const userId = Number(req.body.user_id);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[invitation]] = await connection.query(
      `SELECT invitation_id, user_id, board_id
       FROM WORKOUTINVITATION
       WHERE invitation_id = ?
       FOR UPDATE`,
      [invitationId]
    );

    if (!invitation) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(invitation.user_id) !== userId) {
      await connection.rollback();
      return res.status(403).json({ error: '只有發起人可以取消揪團' });
    }

    await connection.query(
      'DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ?',
      [invitationId]
    );

    const [result] = await connection.query(
      'DELETE FROM WORKOUTINVITATION WHERE invitation_id = ?',
      [invitationId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    await connection.commit();

    res.json({
      message: '取消揪團成功',
      board_id: invitation.board_id,
    });
  } catch (err) {
    await connection.rollback();
    sendServerError(res, err);
  } finally {
    connection.release();
  }
});

module.exports = router;