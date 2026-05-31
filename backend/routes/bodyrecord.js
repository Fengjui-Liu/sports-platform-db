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

function toMysqlDateTime(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim().replace('T', ' ').replace(/Z$/, '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    return null;
  }

  const hour = String(match[2] || '00').padStart(2, '0');
  const minute = String(match[3] || '00').padStart(2, '0');
  const second = String(match[4] || '00').padStart(2, '0');
  return `${match[1]} ${hour}:${minute}:${second}`;
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

function getMonthBounds(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const end = new Date(year, monthIndex + 1, 0);
  const endMonth = String(end.getMonth() + 1).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');

  return {
    startDate: `${match[1]}-${match[2]}-01`,
    endDate: `${end.getFullYear()}-${endMonth}-${endDay}`,
  };
}

function normalizeBodyRecordPayload(body = {}) {
  const bodyFat = body.body_fat ?? body.bodyFat;
  const recordedAt = toMysqlDateTime(body.recorded_at || body.recordedAt);
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
    payload.recordedAt &&
    payload.recordDate
  );
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
    sendServerError(res, err);
  }
});

// 查詢指定使用者的身體數據
// 支援 query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
router.get('/', async (req, res) => {
  const userId = parseId(req.params.id);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: '無效的 user id' });
  }

  const { month, start_date: startDate, end_date: endDate } = req.query;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const monthBounds = month ? getMonthBounds(month) : null;

  if (month && !monthBounds) {
    return res.status(400).json({ error: '無效的 month 格式，請使用 YYYY-MM' });
  }

  if (startDate && !datePattern.test(startDate)) {
    return res.status(400).json({ error: '無效的 start_date 格式，請使用 YYYY-MM-DD' });
  }
  if (endDate && !datePattern.test(endDate)) {
    return res.status(400).json({ error: '無效的 end_date 格式，請使用 YYYY-MM-DD' });
  }

  const conditions = ['user_id = ?'];
  const params = [userId];

  if (monthBounds) {
    conditions.push('record_date >= ?');
    params.push(monthBounds.startDate);
    conditions.push('record_date <= ?');
    params.push(monthBounds.endDate);
  } else if (startDate) {
    conditions.push('record_date >= ?');
    params.push(startDate);
  }
  if (!monthBounds && endDate) {
    conditions.push('record_date <= ?');
    params.push(endDate);
  }

  try {
    const [rows] = await db.query(
      `SELECT record_id, user_id, weight, height, body_fat, recorded_at, record_date
       FROM BODYRECORD
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC, record_id DESC`,
      params
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
