const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

async function getInvitationParticipants(invitationIds) {
  const ids = [...new Set(invitationIds.map((id) => Number(id)).filter(Number.isFinite))];
  if (!ids.length) {
    return new Map();
  }

  const [rows] = await db.query(
    `SELECT ip.invitation_id, ip.user_id, ip.status, u.username
     FROM INVITATIONPARTICIPANT ip
     JOIN USER u ON u.user_id = ip.user_id
     WHERE ip.invitation_id IN (?)
       AND ip.status <> 'cancelled'
     ORDER BY
       CASE ip.status WHEN 'confirmed' THEN 0 WHEN 'waitlisted' THEN 1 ELSE 2 END,
       ip.joined_at ASC,
       ip.user_id ASC`,
    [ids]
  );

  const participantsByInvitation = new Map();
  rows.forEach((row) => {
    if (!participantsByInvitation.has(row.invitation_id)) {
      participantsByInvitation.set(row.invitation_id, []);
    }
    participantsByInvitation.get(row.invitation_id).push({
      user_id: row.user_id,
      username: row.username,
      status: row.status,
    });
  });

  return participantsByInvitation;
}

async function attachInvitationParticipants(rows) {
  const participantsByInvitation = await getInvitationParticipants(rows.map((row) => row.invitation_id));

  return rows.map((row) => {
    const participants = participantsByInvitation.get(row.invitation_id) || [];
    if (!participants.some((participant) => Number(participant.user_id) === Number(row.user_id))) {
      participants.unshift({
        user_id: row.user_id,
        username: row.username,
        status: 'confirmed',
      });
    }

    const confirmedParticipants = participants.filter((participant) => participant.status === 'confirmed');

    return {
      ...row,
      participant_count: confirmedParticipants.length,
      participants,
      participant_usernames: confirmedParticipants.map((participant) => participant.username).join(','),
    };
  });
}

async function promoteNextWaitlisted(invitationId) {
  const [[invitation]] = await db.query(
    `SELECT i.max_participants,
            COUNT(CASE WHEN ip.status = 'confirmed' THEN 1 END) AS confirmed_count
     FROM WORKOUTINVITATION i
     LEFT JOIN INVITATIONPARTICIPANT ip
       ON ip.invitation_id = i.invitation_id AND ip.status = 'confirmed'
     WHERE i.invitation_id = ?
     GROUP BY i.invitation_id, i.max_participants`,
    [invitationId]
  );

  if (!invitation || Number(invitation.confirmed_count) >= Number(invitation.max_participants)) {
    return null;
  }

  const [[nextParticipant]] = await db.query(
    `SELECT user_id
     FROM INVITATIONPARTICIPANT
     WHERE invitation_id = ? AND status = 'waitlisted'
     ORDER BY joined_at ASC
     LIMIT 1`,
    [invitationId]
  );

  if (!nextParticipant) {
    return null;
  }

  await db.query(
    `UPDATE INVITATIONPARTICIPANT
     SET status = 'confirmed'
     WHERE invitation_id = ? AND user_id = ?`,
    [invitationId, nextParticipant.user_id]
  );

  return nextParticipant.user_id;
}

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

    await db.query(
      `INSERT INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at, status)
       VALUES (?, ?, NOW(), 'confirmed')
       ON DUPLICATE KEY UPDATE status = 'confirmed'`,
      [result.insertId, user_id]
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
            AND ip.status <> 'cancelled'
        )`
      );
      params.push(participantUserId);
    }

    if (boardId && !ownerId && !participantUserId) {
      whereParts.push('i.event_time > NOW()');
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(' AND ')}`
      : '';

    const [rows] = await db.query(
      `SELECT i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
              i.max_participants, i.created_at,
              u.username,
              b.sport_type AS board_name,
              COUNT(DISTINCT CASE WHEN p.status = 'confirmed' THEN p.user_id END) AS participant_count,
              COUNT(DISTINCT CASE WHEN p.status = 'waitlisted' THEN p.user_id END) AS waitlist_count,
              MAX(CASE WHEN vp.user_id IS NULL OR vp.status = 'cancelled' THEN 0 ELSE 1 END) AS joined_by_viewer,
              MAX(CASE WHEN vp.user_id IS NULL THEN NULL ELSE vp.status END) AS viewer_status
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       LEFT JOIN INVITATIONPARTICIPANT vp ON vp.invitation_id = i.invitation_id AND vp.user_id = ?
       ${whereClause}
       GROUP BY i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
                i.max_participants, i.created_at, u.username, b.sport_type
       ORDER BY
         CASE WHEN i.event_time <= NOW() THEN 1 ELSE 0 END,
         i.event_time ASC,
         i.invitation_id DESC`,
      params
    );

    res.json(await attachInvitationParticipants(rows));
  } catch (err) {
    sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const invitationId = parseId(req.params.id);
  const viewerId = req.query.user_id ? parseId(req.query.user_id) : null;

  if (Number.isNaN(invitationId)) {
    return res.status(400).json({ error: '無效的 invitation id' });
  }

  if (req.query.user_id && Number.isNaN(viewerId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
              i.max_participants, i.created_at,
              u.username,
              b.sport_type AS board_name,
              COUNT(DISTINCT p.user_id) +
                CASE WHEN COUNT(DISTINCT CASE WHEN p.user_id = i.user_id THEN p.user_id END) = 0 THEN 1 ELSE 0 END
                AS participant_count,
              COUNT(DISTINCT CASE WHEN p.status = 'waitlisted' THEN p.user_id END) AS waitlist_count,
              MAX(CASE WHEN vp.user_id IS NULL OR vp.status = 'cancelled' THEN 0 ELSE 1 END) AS joined_by_viewer,
              MAX(CASE WHEN vp.user_id IS NULL THEN NULL ELSE vp.status END) AS viewer_status
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       LEFT JOIN INVITATIONPARTICIPANT vp ON vp.invitation_id = i.invitation_id AND vp.user_id = ?
       WHERE i.invitation_id = ?
       GROUP BY i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
                i.max_participants, i.created_at, u.username, b.sport_type`,
      [viewerId, invitationId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: '找不到揪團' });
    }

    const [invitation] = await attachInvitationParticipants(rows);
    res.json(invitation);
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
      `SELECT i.max_participants,
              i.event_time,
              NOW() >= i.event_time AS is_closed,
              COUNT(DISTINCT p.user_id) +
                CASE WHEN COUNT(DISTINCT CASE WHEN p.user_id = i.user_id THEN p.user_id END) = 0 THEN 1 ELSE 0 END
                AS participant_count,
              MAX(CASE WHEN vp.user_id IS NULL THEN NULL ELSE vp.status END) AS existing_status
       FROM WORKOUTINVITATION i
       LEFT JOIN INVITATIONPARTICIPANT p
         ON p.invitation_id = i.invitation_id AND p.status = 'confirmed'
       LEFT JOIN INVITATIONPARTICIPANT vp
         ON vp.invitation_id = i.invitation_id AND vp.user_id = ?
       WHERE i.invitation_id = ?
       GROUP BY i.invitation_id, i.max_participants, i.event_time`,
      [userId, invitationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到揪團活動' });
    }

    if (Number(rows[0].is_closed)) {
      return res.status(400).json({ error: '活動已開始，報名截止' });
    }

    if (rows[0].existing_status && rows[0].existing_status !== 'cancelled') {
      return res.json({
        message: rows[0].existing_status === 'confirmed' ? '已加入揪團' : '已在候補名單',
        status: rows[0].existing_status,
      });
    }

    if (Number(rows[0].participant_count) >= Number(rows[0].max_participants)) {
      return res.status(400).json({ error: '揪團人數已滿' });
    }

    await db.query(
      `INSERT INTO INVITATIONPARTICIPANT (invitation_id, user_id, joined_at, status)
       VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at), status = VALUES(status)`,
      [invitationId, userId, 'confirmed']
    );

    const [updatedRows] = await db.query(
      `SELECT i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
              i.max_participants, i.created_at,
              u.username,
              b.sport_type AS board_name,
              COUNT(DISTINCT p.user_id) +
                CASE WHEN COUNT(DISTINCT CASE WHEN p.user_id = i.user_id THEN p.user_id END) = 0 THEN 1 ELSE 0 END
                AS participant_count,
              COUNT(DISTINCT CASE WHEN p.status = 'waitlisted' THEN p.user_id END) AS waitlist_count,
              1 AS joined_by_viewer,
              'confirmed' AS viewer_status
       FROM WORKOUTINVITATION i
       JOIN USER u ON u.user_id = i.user_id
       JOIN SPORTBOARD b ON b.board_id = i.board_id
       LEFT JOIN INVITATIONPARTICIPANT p ON p.invitation_id = i.invitation_id
       WHERE i.invitation_id = ?
       GROUP BY i.invitation_id, i.user_id, i.board_id, i.title, i.location, i.event_time,
                i.max_participants, i.created_at, u.username, b.sport_type`,
      [invitationId]
    );
    const [updatedInvitation] = await attachInvitationParticipants(updatedRows);

    res.json({
      message: '加入揪團成功',
      status: 'confirmed',
      participant_count: updatedInvitation?.participant_count || 0,
      participants: updatedInvitation?.participants || [],
      invitation: updatedInvitation,
    });
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
    const [[invitation]] = await db.query(
      'SELECT user_id FROM WORKOUTINVITATION WHERE invitation_id = ?',
      [invitationId]
    );

    if (!invitation) {
      return res.status(404).json({ error: '找不到揪團' });
    }

    if (Number(invitation.user_id) === Number(req.body.user_id)) {
      return res.status(400).json({ error: '發起人不能退出自己的揪團，請改用取消揪團' });
    }

    await db.query(
      'DELETE FROM INVITATIONPARTICIPANT WHERE invitation_id = ? AND user_id = ?',
      [invitationId, req.body.user_id]
    );
    await promoteNextWaitlisted(invitationId);

    res.json({ message: '退出揪團成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
