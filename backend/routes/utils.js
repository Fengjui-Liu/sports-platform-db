const sendServerError = (res, err) => {
  res.status(500).json({ error: err.message || '伺服器錯誤' });
};

const parseId = (value) => Number.parseInt(value, 10);

const ensureRequired = (res, payload, fields) => {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
  if (missing.length > 0) {
    res.status(400).json({ error: `缺少欄位: ${missing.join(', ')}` });
    return false;
  }
  return true;
};

module.exports = {
  ensureRequired,
  parseId,
  sendServerError,
};
