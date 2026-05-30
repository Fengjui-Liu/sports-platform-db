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
  await db.query('SET FOREIGN_KEY_CHECKS = 0');

  // ── 建立基礎表（依賴順序：USER 最先）────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS USER (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(16) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      bio TEXT,
      profile_image VARCHAR(255),
      skill_levels JSON DEFAULT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS BODYRECORD (
      record_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      weight DECIMAL(5,2) NOT NULL,
      height DECIMAL(5,2) NOT NULL,
      body_fat DECIMAL(5,2) NOT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      record_date DATE NOT NULL,
      UNIQUE KEY unique_user_record_date (user_id, record_date),
      CONSTRAINT fk_bodyrecord_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS SPORTBOARD (
      board_id INT AUTO_INCREMENT PRIMARY KEY,
      sport_type VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS WORKOUTPLAN (
      plan_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      is_public BOOLEAN DEFAULT TRUE,
      sport_type VARCHAR(50) NOT NULL,
      difficulty_level ENUM('easy', 'medium', 'hard') NOT NULL,
      exercise_name VARCHAR(50) NOT NULL,
      muscle_group VARCHAR(50) NOT NULL,
      reps INT NOT NULL,
      \`sets\` INT NOT NULL,
      target_distance DECIMAL(6,2) DEFAULT NULL,
      target_duration INT DEFAULT NULL,
      rounds INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_workoutplan_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS WORKOUTSESSION (
      session_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      plan_id INT NOT NULL,
      notes TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      CONSTRAINT fk_workoutsession_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_workoutsession_plan FOREIGN KEY (plan_id) REFERENCES WORKOUTPLAN(plan_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS POST (
      post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      board_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      post_type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_post_feed (board_id, created_at DESC),
      CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_post_board FOREIGN KEY (board_id) REFERENCES SPORTBOARD(board_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS COMMENT (
      comment_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_comment_lookup (post_id, created_at ASC),
      CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS WORKOUTINVITATION (
      invitation_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      board_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      event_time TIMESTAMP NOT NULL,
      max_participants INT NOT NULL,
      latitude DECIMAL(10,8) DEFAULT NULL,
      longitude DECIMAL(11,8) DEFAULT NULL,
      required_skill_level INT DEFAULT 1,
      location_point POINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      SPATIAL INDEX idx_invitation_location (location_point),
      INDEX idx_invitation_time (event_time),
      INDEX idx_invitation_skill (required_skill_level),
      CONSTRAINT fk_workoutinvitation_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_workoutinvitation_board FOREIGN KEY (board_id) REFERENCES SPORTBOARD(board_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS POSTLIKE (
      post_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id),
      INDEX idx_postlike_post_created (post_id, created_at),
      CONSTRAINT fk_postlike_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE,
      CONSTRAINT fk_postlike_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS POSTBOOKMARK (
      user_id INT NOT NULL,
      post_id INT NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      INDEX idx_postbookmark_post (post_id),
      INDEX idx_postbookmark_user (user_id),
      CONSTRAINT fk_postbookmark_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_postbookmark_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS WORKOUTPLANSAVE (
      plan_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (plan_id, user_id),
      CONSTRAINT fk_workoutplansave_plan FOREIGN KEY (plan_id) REFERENCES WORKOUTPLAN(plan_id) ON DELETE CASCADE,
      CONSTRAINT fk_workoutplansave_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS INVITATIONPARTICIPANT (
      invitation_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('confirmed', 'waitlisted', 'cancelled') DEFAULT 'confirmed',
      PRIMARY KEY (invitation_id, user_id),
      INDEX idx_participant_status (status),
      CONSTRAINT fk_invitationparticipant_invitation FOREIGN KEY (invitation_id) REFERENCES WORKOUTINVITATION(invitation_id) ON DELETE CASCADE,
      CONSTRAINT fk_invitationparticipant_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS USERFOLLOW (
      followee_id INT NOT NULL,
      follower_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (followee_id, follower_id),
      INDEX idx_userfollow_follower_created (follower_id, created_at),
      INDEX idx_userfollow_followee_created (followee_id, created_at),
      CONSTRAINT chk_userfollow_not_self CHECK (followee_id <> follower_id),
      CONSTRAINT fk_userfollow_followee FOREIGN KEY (followee_id) REFERENCES USER(user_id) ON DELETE CASCADE,
      CONSTRAINT fk_userfollow_follower FOREIGN KEY (follower_id) REFERENCES USER(user_id) ON DELETE CASCADE
    )
  `);

  // ── Triggers ──────────────────────────────────────────────────────────────

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

  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  // ── Migrations（舊資料庫補欄位／索引，新資料庫會 skip）──────────────────

  await runSafe('USER.skill_levels', async () => {
    if (!(await columnExists('USER', 'skill_levels'))) {
      await db.query('ALTER TABLE USER ADD COLUMN skill_levels JSON DEFAULT NULL');
    }
  });

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

  await runSafe('BODYRECORD.record_date', async () => {
    if (!(await columnExists('BODYRECORD', 'record_date'))) {
      await db.query('ALTER TABLE BODYRECORD ADD COLUMN record_date DATE NULL AFTER recorded_at');
      await db.query(`UPDATE BODYRECORD SET record_date = DATE(recorded_at) WHERE record_date IS NULL`);
      await db.query('ALTER TABLE BODYRECORD MODIFY COLUMN record_date DATE NOT NULL');
    }
  });

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

  await runSafe('INVITATIONPARTICIPANT.status', async () => {
    if (!(await columnExists('INVITATIONPARTICIPANT', 'status'))) {
      await db.query(`
        ALTER TABLE INVITATIONPARTICIPANT
        ADD COLUMN status ENUM('confirmed','waitlisted','cancelled') DEFAULT 'confirmed'
      `);
    }
  });

  await runSafe('WORKOUTPLAN.target_distance', async () => {
    if (!(await columnExists('WORKOUTPLAN', 'target_distance'))) {
      await db.query('ALTER TABLE WORKOUTPLAN ADD COLUMN target_distance DECIMAL(6,2) DEFAULT NULL');
    }
  });

  await runSafe('WORKOUTPLAN.target_duration', async () => {
    if (!(await columnExists('WORKOUTPLAN', 'target_duration'))) {
      await db.query('ALTER TABLE WORKOUTPLAN ADD COLUMN target_duration INT DEFAULT NULL');
    }
  });

  await runSafe('WORKOUTPLAN.rounds', async () => {
    if (!(await columnExists('WORKOUTPLAN', 'rounds'))) {
      await db.query('ALTER TABLE WORKOUTPLAN ADD COLUMN rounds INT DEFAULT NULL');
    }
  });
}

module.exports = initDb;
