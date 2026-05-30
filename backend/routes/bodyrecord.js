const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const DUPLICATE_CREATE_MESSAGE = '該日期已經有身體數據紀錄，請改用編輯功能修改。';
const DUPLICATE_UPDATE_MESSAGE = '該日期已經有其他身體數據紀錄，請選擇不同日期。';

function getRequestUserId(req) {
  return parseId(req.get('x-user-id') || req.body?.user_id || req.query.user_id);
}

function ensureOwnProfile(req, res) {
  const userId = parseId(req.params.id);
  const requestUserId = getRequestUserId(req);

  if (Number.isNaN(userId)) {
    res.status(400).json({ error: '無效的 user id' });
    return null;
  }

  if (Number.isNaN(requestUserId)) {
    res.status(401).json({ error: '請先登入' });
    return null;
  }

  if (requestUserId !== userId) {
    res.status(403).json({ error: '不可修改其他使用者的身體數據' });
    return null;
  }

  return userId;
}

function getRecordDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeBodyRecordPayload(body = {}) {
  const bodyFat = body.body_fat ?? body.bodyFat;
  const recordedAt = body.recorded_at || body.recordedAt || new Date();
  const recordDate = body.record_date || body.recordDate || getRecordDate(recordedAt);

  return {
    weight: body.weight,
    height: body.height,
    bodyFat,
    recordedAt,
    recordDate,
  };
}

function hasRequiredBodyRecordFields(payload) {
  return (
    payload.weight !== undefined &&
    payload.weight !== null &&
    payload.height !== undefined &&
    payload.height !== null &&
    payload.bodyFat !== undefined &&
    payload.bodyFat !== null &&
    payload.recordDate
  );
}

async function findDuplicateRecord(userId, recordDate, excludeRecordId = null) {
  const params = [userId, recordDate];
  let excludeClause = '';

  if (excludeRecordId !== null) {
    excludeClause = 'AND record_id <> ?';
    params.push(excludeRecordId);
  }

  const [rows] = await db.query(
    `SELECT record_id
     FROM BODYRECORD
     WHERE user_id = ? AND record_date = ?
     ${excludeClause}
     LIMIT 1`,
    params
  );

  return rows[0] || null;
}

function mapBodyRecord(row) {
  return {
    record_id: row.record_id,
    recordId: row.record_id,
    id: row.record_id,
    user_id: row.user_id,
    weight: row.weight,
    height: row.height,
    body_fat: row.body_fat,
    bodyFat: row.body_fat,
    recorded_at: row.recorded_at,
    recordedAt: row.recorded_at,
    record_date: row.record_date,
    recordDate: row.record_date,
  };
}

// 新增身體數據
router.post('/', async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  if (userId === null) {
    return;
  }

  const payload = normalizeBodyRecordPayload(req.body);
  if (!hasRequiredBodyRecordFields(payload)) {
    return res.status(400).json({ error: 'weight、height、body_fat、recorded_at 為必填欄位' });
  }

  try {
    const duplicate = await findDuplicateRecord(userId, payload.recordDate);
    if (duplicate) {
      return res.status(409).json({
        error: DUPLICATE_CREATE_MESSAGE,
        message: DUPLICATE_CREATE_MESSAGE,
      });
    }

    const [result] = await db.query(
      `INSERT INTO BODYRECORD (user_id, weight, height, body_fat, recorded_at, record_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, payload.weight, payload.height, payload.bodyFat, payload.recordedAt, payload.recordDate]
    );

    res.json({
      message: '新增身體數據成功',
      record_id: result.insertId,
      recordId: result.insertId,
      id: result.insertId,
      weight: payload.weight,
      height: payload.height,
      body_fat: payload.bodyFat,
      bodyFat: payload.bodyFat,
      recorded_at: payload.recordedAt,
      recordedAt: payload.recordedAt,
      record_date: payload.recordDate,
      recordDate: payload.recordDate,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: DUPLICATE_CREATE_MESSAGE,
        message: DUPLICATE_CREATE_MESSAGE,
      });
    }
    sendServerError(res, err);
  }
});

// 查詢指定使用者的身體數據
router.get('/', async (req, res) => {
  const userId = parseId(req.params.id);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  try {
    const [rows] = await db.query(
      `SELECT record_id, user_id, weight, height, body_fat, recorded_at, record_date
       FROM BODYRECORD
       WHERE user_id = ?
       ORDER BY recorded_at DESC, record_id DESC`,
      [userId]
    );

    res.json(rows.map(mapBodyRecord));
  } catch (err) {
    sendServerError(res, err);
  }
});

// 修改身體數據
router.put('/:recordId', async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  const recordId = parseId(req.params.recordId);

  if (userId === null) {
    return;
  }

  if (Number.isNaN(recordId)) {
    return res.status(400).json({ error: '無效的 record id' });
  }

  const payload = normalizeBodyRecordPayload(req.body);
  if (!hasRequiredBodyRecordFields(payload)) {
    return res.status(400).json({ error: 'weight、height、body_fat、recorded_at 為必填欄位' });
  }

  try {
    const [existingRows] = await db.query(
      'SELECT record_id, user_id FROM BODYRECORD WHERE record_id = ? LIMIT 1',
      [recordId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: '找不到身體數據紀錄' });
    }

    if (Number(existingRows[0].user_id) !== userId) {
      return res.status(403).json({ error: '不可修改其他使用者的身體數據' });
    }

    const duplicate = await findDuplicateRecord(userId, payload.recordDate, recordId);
    if (duplicate) {
      return res.status(409).json({
        error: DUPLICATE_UPDATE_MESSAGE,
        message: DUPLICATE_UPDATE_MESSAGE,
      });
    }

    await db.query(
      `UPDATE BODYRECORD
       SET weight = ?, height = ?, body_fat = ?, recorded_at = ?, record_date = ?
       WHERE record_id = ? AND user_id = ?`,
      [payload.weight, payload.height, payload.bodyFat, payload.recordedAt, payload.recordDate, recordId, userId]
    );

    res.json({
      message: '更新身體數據成功',
      record_id: recordId,
      recordId,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: DUPLICATE_UPDATE_MESSAGE,
        message: DUPLICATE_UPDATE_MESSAGE,
      });
    }
    sendServerError(res, err);
  }
});

// 刪除身體數據
router.delete('/:recordId', async (req, res) => {
  const userId = ensureOwnProfile(req, res);
  const recordId = parseId(req.params.recordId);

  if (userId === null) {
    return;
  }

  if (Number.isNaN(recordId)) {
    return res.status(400).json({ error: '無效的 record id' });
  }

  try {
    const [existingRows] = await db.query(
      'SELECT record_id, user_id FROM BODYRECORD WHERE record_id = ? LIMIT 1',
      [recordId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: '找不到身體數據紀錄' });
    }

    if (Number(existingRows[0].user_id) !== userId) {
      return res.status(403).json({ error: '不可刪除其他使用者的身體數據' });
    }

    await db.query('DELETE FROM BODYRECORD WHERE record_id = ? AND user_id = ?', [recordId, userId]);

    res.json({ message: '刪除身體數據成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
