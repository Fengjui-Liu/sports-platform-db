const db = require('./db');

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS POSTBOOKMARK (
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      CONSTRAINT fk_postbookmark_user
        FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_postbookmark_post
        FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE,
      INDEX idx_postbookmark_post (post_id),
      INDEX idx_postbookmark_user (user_id)
    )
  `);
}

module.exports = initDb;
