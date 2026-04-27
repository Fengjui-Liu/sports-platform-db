const express = require('express');
const db = require('../db');
const { parseId, sendServerError } = require('./utils');

const router = express.Router();

router.delete('/:id', async (req, res) => {
  const commentId = parseId(req.params.id);
  if (Number.isNaN(commentId)) {
    return res.status(400).json({ error: '無效的 comment id' });
  }

  try {
    const [result] = await db.query('DELETE FROM COMMENT WHERE comment_id = ?', [commentId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '找不到留言' });
    }
    res.json({ message: '刪除留言成功' });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
