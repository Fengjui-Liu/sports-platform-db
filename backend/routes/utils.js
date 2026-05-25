const sendServerError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: '伺服器錯誤' });
};

const parseId = (value) => {
  if (value === undefined || value === null) return NaN;

  const stringValue = String(value);
  if (!/^\d+$/.test(stringValue)) return NaN;

  return Number.parseInt(stringValue, 10);
};

const ensureRequired = (res, payload, fields) => {
  const missing = fields.filter((field) => {
    const value = payload[field];

    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  }); 
  
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
