const express = require('express');
const db = require('../db');
const { ensureRequired, parseId, sendServerError } = require('./utils');

const router = express.Router();

router.delete('/:id', async (req, res) => {
  const commentId = parseId(req.params.id);
  if (Number.isNaN(commentId)) {
    return res.status(400).json({ error: '無效的 comment id' });
  }

  if (!ensureRequired(res, req.body, ['user_id'])) {
    return;
  }

  try {
    const [[comment]] = await db.query('SELECT user_id FROM COMMENT WHERE comment_id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({ error: '找不到留言' });
    }
    if (Number(comment.user_id) !== Number(req.body.user_id)) {
      return res.status(403).json({ error: '只能刪除自己的留言' });
    }

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
