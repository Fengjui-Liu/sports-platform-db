const db = require('./db');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
}

async function runSafe(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[initDb] ${label} skipped:`, err.message);
  }
}

async function initDb() {
  // ── 1. POSTBOOKMARK ───────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS POSTBOOKMARK (
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      CONSTRAINT fk_postbookmark_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_postbookmark_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE,
      INDEX idx_postbookmark_post (post_id),
      INDEX idx_postbookmark_user (user_id)
    )
  `);

  // ── 2. USER columns (from migration_v2) ───────────────────────────────────
  await runSafe('USER.skill_levels', async () => {
    if (!(await columnExists('USER', 'skill_levels'))) {
      await db.query('ALTER TABLE USER ADD COLUMN skill_levels JSON DEFAULT NULL');
    }
  });

  // ── 3. POST.title column ──────────────────────────────────────────────────
  await runSafe('POST.title', async () => {
    if (!(await columnExists('POST', 'title'))) {
      await db.query('ALTER TABLE POST ADD COLUMN title VARCHAR(255) NULL AFTER board_id');
      await db.query(`
        UPDATE POST
        SET title = COALESCE(NULLIF(TRIM(LEFT(content, 80)), ''), CONCAT('貼文 #', post_id))
        WHERE title IS NULL OR TRIM(title) = ''
      `);
      await db.query('ALTER TABLE POST MODIFY COLUMN title VARCHAR(255) NOT NULL');
    }
  });

  // ── 4. WORKOUTINVITATION columns ─────────────────────────────────────────
  await runSafe('WORKOUTINVITATION.latitude', async () => {
    if (!(await columnExists('WORKOUTINVITATION', 'latitude'))) {
      await db.query('ALTER TABLE WORKOUTINVITATION ADD COLUMN latitude DECIMAL(10,8) DEFAULT NULL');
    }
  });

  await runSafe('WORKOUTINVITATION.longitude', async () => {
    if (!(await columnExists('WORKOUTINVITATION', 'longitude'))) {
      await db.query('ALTER TABLE WORKOUTINVITATION ADD COLUMN longitude DECIMAL(11,8) DEFAULT NULL');
    }
  });

  await runSafe('WORKOUTINVITATION.required_skill_level', async () => {
    if (!(await columnExists('WORKOUTINVITATION', 'required_skill_level'))) {
      await db.query('ALTER TABLE WORKOUTINVITATION ADD COLUMN required_skill_level INT DEFAULT 1');
    }
  });

  // ── 5. WORKOUTINVITATION.location_point (spatial) ────────────────────────
  await runSafe('WORKOUTINVITATION.location_point spatial column', async () => {
    if (await indexExists('WORKOUTINVITATION', 'idx_invitation_location')) {
      await db.query('ALTER TABLE WORKOUTINVITATION DROP INDEX idx_invitation_location');
    }
    if (await columnExists('WORKOUTINVITATION', 'location_point')) {
      await db.query('ALTER TABLE WORKOUTINVITATION DROP COLUMN location_point');
    }
    await db.query('ALTER TABLE WORKOUTINVITATION ADD COLUMN location_point POINT NULL');
    await db.query(`
      UPDATE WORKOUTINVITATION
      SET location_point = ST_PointFromText(
        CONCAT('POINT(', COALESCE(longitude, 0), ' ', COALESCE(latitude, 0), ')'), 4326
      )
    `);
    await db.query(`
      UPDATE WORKOUTINVITATION
      SET location_point = ST_PointFromText('POINT(0 0)', 4326)
      WHERE location_point IS NULL
    `);
    await db.query('ALTER TABLE WORKOUTINVITATION MODIFY COLUMN location_point POINT NOT NULL');
    await db.query('ALTER TABLE WORKOUTINVITATION ADD SPATIAL INDEX idx_invitation_location (location_point)');
  });

  // ── 6. WORKOUTINVITATION indexes ──────────────────────────────────────────
  await runSafe('idx_invitation_time', async () => {
    if (!(await indexExists('WORKOUTINVITATION', 'idx_invitation_time'))) {
      await db.query('ALTER TABLE WORKOUTINVITATION ADD INDEX idx_invitation_time (event_time)');
    }
  });

  await runSafe('idx_invitation_skill', async () => {
    if (!(await indexExists('WORKOUTINVITATION', 'idx_invitation_skill'))) {
      await db.query('ALTER TABLE WORKOUTINVITATION ADD INDEX idx_invitation_skill (required_skill_level)');
    }
  });

  // ── 7. INVITATIONPARTICIPANT.status ───────────────────────────────────────
  await runSafe('INVITATIONPARTICIPANT.status', async () => {
    if (!(await columnExists('INVITATIONPARTICIPANT', 'status'))) {
      await db.query(`
        ALTER TABLE INVITATIONPARTICIPANT
        ADD COLUMN status ENUM('confirmed','waitlisted','cancelled') DEFAULT 'confirmed'
      `);
    }
  });

  await runSafe('idx_participant_status', async () => {
    if (!(await indexExists('INVITATIONPARTICIPANT', 'idx_participant_status'))) {
      await db.query('ALTER TABLE INVITATIONPARTICIPANT ADD INDEX idx_participant_status (status)');
    }
  });

  // ── 8. POST indexes ───────────────────────────────────────────────────────
  await runSafe('idx_post_feed', async () => {
    if (!(await indexExists('POST', 'idx_post_feed'))) {
      await db.query('ALTER TABLE POST ADD INDEX idx_post_feed (board_id, created_at DESC)');
    }
  });

  await runSafe('idx_postlike_post_created', async () => {
    if (!(await indexExists('POSTLIKE', 'idx_postlike_post_created'))) {
      await db.query('ALTER TABLE POSTLIKE ADD INDEX idx_postlike_post_created (post_id, created_at)');
    }
  });

  await runSafe('idx_comment_lookup', async () => {
    if (!(await indexExists('COMMENT', 'idx_comment_lookup'))) {
      await db.query('ALTER TABLE COMMENT ADD INDEX idx_comment_lookup (post_id, created_at ASC)');
    }
  });

  // ── 9. Triggers for location_point ───────────────────────────────────────
  await runSafe('trigger workoutinvitation_location_bi', async () => {
    await db.query('DROP TRIGGER IF EXISTS workoutinvitation_location_bi');
    await db.query(`
      CREATE TRIGGER workoutinvitation_location_bi
      BEFORE INSERT ON WORKOUTINVITATION
      FOR EACH ROW
      BEGIN
        SET NEW.location_point = ST_PointFromText(
          CONCAT('POINT(', COALESCE(NEW.longitude, 0), ' ', COALESCE(NEW.latitude, 0), ')'), 4326
        );
      END
    `);
  });

  await runSafe('trigger workoutinvitation_location_bu', async () => {
    await db.query('DROP TRIGGER IF EXISTS workoutinvitation_location_bu');
    await db.query(`
      CREATE TRIGGER workoutinvitation_location_bu
      BEFORE UPDATE ON WORKOUTINVITATION
      FOR EACH ROW
      BEGIN
        SET NEW.location_point = ST_PointFromText(
          CONCAT('POINT(', COALESCE(NEW.longitude, 0), ' ', COALESCE(NEW.latitude, 0), ')'), 4326
        );
      END
    `);
  });
}

module.exports = initDb;
