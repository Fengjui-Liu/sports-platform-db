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
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      sport_type VARCHAR(50) NOT NULL,
      difficulty_level ENUM('easy', 'medium', 'hard') NOT NULL,
      exercise_name VARCHAR(50) NOT NULL,
      muscle_group VARCHAR(50) DEFAULT NULL,
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

  await runSafe('WORKOUTPLAN.is_public', async () => {
    if (!(await columnExists('WORKOUTPLAN', 'is_public'))) {
      await db.query('ALTER TABLE WORKOUTPLAN ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE AFTER title');
    } else {
      await db.query('UPDATE WORKOUTPLAN SET is_public = TRUE WHERE is_public IS NULL');
      await db.query('ALTER TABLE WORKOUTPLAN MODIFY COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE');
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

  await seedData();
}

async function seedData() {
  const [rows] = await db.query('SELECT COUNT(*) as count FROM USER');
  if (rows[0].count > 0) return;

  console.log('[initDb] 空資料庫，開始 seed sample data...');
  await db.query('SET FOREIGN_KEY_CHECKS = 0');

  await db.query(`
    INSERT INTO USER (user_id, username, password, email, bio, profile_image, skill_levels) VALUES
    (1,  'ryder_liu',   '$2b$10$hashedpw1', 'ryder@sportboard.tw',  '熱愛籃球與重訓，每天都在精進自己。',   NULL, '{"basketball":4,"gym":3}'),
    (2,  'ken_wu',      '$2b$10$hashedpw2', 'ken@sportboard.tw',    '跑步愛好者，台北馬拉松完賽選手。',      NULL, '{"running":5}'),
    (3,  'amy_chen',    '$2b$10$hashedpw3', 'amy@sportboard.tw',    '游泳教練，專長自由式與蝶式。',          NULL, '{"swimming":5,"cycling":3}'),
    (4,  'jason_lin',   '$2b$10$hashedpw4', 'jason@sportboard.tw',  '羽球社幹部，周末揪團打球。',            NULL, '{"badminton":4}'),
    (5,  'sarah_huang', '$2b$10$hashedpw5', 'sarah@sportboard.tw',  '瑜珈老師，也熱愛騎車。',               NULL, '{"cycling":4,"yoga":5}'),
    (6,  'mike_chang',  '$2b$10$hashedpw6', 'mike@sportboard.tw',   '籃球隊隊長，三分線是我的領域。',        NULL, '{"basketball":5}'),
    (7,  'lily_wang',   '$2b$10$hashedpw7', 'lily@sportboard.tw',   '健身三年，喜歡分享訓練心得。',          NULL, '{"gym":4}'),
    (8,  'tom_hsu',     '$2b$10$hashedpw8', 'tom@sportboard.tw',    '足球迷，每週固定踢五人制。',            NULL, '{"soccer":4}'),
    (9,  'nina_kao',    '$2b$10$hashedpw9', 'nina@sportboard.tw',   '極限運動愛好者，攀岩滑板都喜歡。',      NULL, '{"extreme":4}'),
    (10, 'peter_tsai',  '$2b$10$hashedpw0', 'peter@sportboard.tw',  '網球教練，帶學生參加業餘賽事。',        NULL, '{"tennis":5}')
  `);

  await db.query(`
    INSERT INTO SPORTBOARD (board_id, sport_type, description, created_at) VALUES
    (1,  '籃球',     '籃球技術討論、揪團、賽事分享',         '2025-01-01 00:00:00'),
    (2,  '跑步',     '路跑、馬拉松、訓練計畫分享',           '2025-01-01 00:00:00'),
    (3,  '游泳',     '游泳技術、訓練、比賽資訊',             '2025-01-01 00:00:00'),
    (4,  '羽球',     '羽球揪團、技術交流、器材討論',         '2025-01-01 00:00:00'),
    (5,  '騎車',     '公路車、登山車、單車旅遊',             '2025-01-01 00:00:00'),
    (6,  '足球',     '五人制、十一人制、賽事討論',           '2025-01-01 00:00:00'),
    (7,  '健身重訓', '重訓課表、營養補給、進度分享',         '2025-01-01 00:00:00'),
    (8,  '極限運動', '攀岩、滑板、衝浪、跑酷',               '2025-01-01 00:00:00'),
    (9,  '網球',     '網球技術、場地資訊、賽事揪團',         '2025-01-01 00:00:00'),
    (10, '格鬥',     '拳擊、柔道、巴西柔術、MMA',            '2025-01-01 00:00:00')
  `);

  await db.query(`
    INSERT INTO WORKOUTPLAN (plan_id, user_id, title, is_public, sport_type, difficulty_level, exercise_name, muscle_group, \`sets\`, reps, target_distance, target_duration, rounds, created_at) VALUES
    (1,  1,  '籃球體能訓練計畫',   1, '健身重訓', 'medium', '深蹲、硬舉、跳繩',     '腿部、核心',       4,    12,   NULL,  NULL, NULL, '2025-02-01 10:00:00'),
    (2,  2,  '馬拉松備戰 12 週',   1, '跑步',     'hard',   '長跑、間歇跑、恢復跑', NULL,               0,    0,    42.2,  720,  NULL, '2025-02-10 09:00:00'),
    (3,  3,  '游泳耐力提升計畫',   1, '游泳',     'medium', '自由式連續游',         NULL,               0,    0,    3.0,   90,   NULL, '2025-02-15 08:00:00'),
    (4,  4,  '羽球爆發力訓練',     1, '健身重訓', 'easy',   '弓步蹲、側向跳、拉力', '腿部、肩部',       3,    15,   NULL,  NULL, NULL, '2025-03-01 10:00:00'),
    (5,  5,  '公路車長途備戰',     1, '騎車',     'hard',   '長距離騎乘',           NULL,               0,    0,    100.0, 240,  NULL, '2025-03-05 07:00:00'),
    (6,  6,  '籃球專項力量訓練',   1, '健身重訓', 'hard',   '臥推、肩推、引體向上', '胸部、肩部、背部', 5,    8,    NULL,  NULL, NULL, '2025-03-10 10:00:00'),
    (7,  7,  '女生居家重訓計畫',   1, '健身重訓', 'easy',   '啞鈴訓練、彈力帶',     '全身',             3,    20,   NULL,  NULL, NULL, '2025-03-15 11:00:00'),
    (8,  8,  '五人制足球體能計畫', 1, '足球',     'medium', '短衝、折返跑、敏捷梯', NULL,               0,    0,    NULL,  60,   NULL, '2025-04-01 10:00:00'),
    (9,  9,  '攀岩核心強化計畫',   1, '極限運動', 'medium', '懸掛核心、握力訓練',   '核心、前臂',       4,    15,   NULL,  NULL, NULL, '2025-04-05 09:00:00'),
    (10, 10, '網球發球力量訓練',   1, '健身重訓', 'medium', '旋轉核心、肩旋轉肌',   '肩部、核心',       3,    12,   NULL,  NULL, NULL, '2025-04-10 10:00:00'),
    (11, 1,  '個人重訓私人課表',   0, '健身重訓', 'hard',   '奧林匹克舉重',         '全身',             5,    5,    NULL,  NULL, NULL, '2025-04-15 10:00:00'),
    (12, 2,  '5K 速度提升計畫',    1, '跑步',     'easy',   '間歇跑 400m x 8',      NULL,               0,    0,    5.0,   30,   NULL, '2025-04-20 09:00:00')
  `);

  await db.query(`
    INSERT INTO WORKOUTSESSION (session_id, user_id, plan_id, notes, start_time, end_time) VALUES
    (1,  1,  1,  '今天狀態很好，深蹲突破 PR',       '2025-05-01 18:00:00', '2025-05-01 19:30:00'),
    (2,  2,  2,  '第一週長跑 20km，配速 5:30',       '2025-05-02 06:00:00', '2025-05-02 08:50:00'),
    (3,  3,  3,  '連游 3000m，中間休息 2 次',        '2025-05-03 07:00:00', '2025-05-03 08:30:00'),
    (4,  4,  4,  '腿部有點酸，訓練量減少 20%',       '2025-05-04 17:00:00', '2025-05-04 18:00:00'),
    (5,  5,  5,  '挑戰陽明山，爬坡段很硬',           '2025-05-05 06:00:00', '2025-05-05 10:00:00'),
    (6,  6,  6,  '臥推 100kg x 5，新里程碑',         '2025-05-06 19:00:00', '2025-05-06 20:30:00'),
    (7,  7,  7,  '全程居家，30 分鐘完成',            '2025-05-07 07:30:00', '2025-05-07 08:00:00'),
    (8,  8,  8,  '折返跑 10 組，心率維持在 165',     '2025-05-08 18:00:00', '2025-05-08 19:00:00'),
    (9,  9,  9,  '懸掛核心撐了 3 分鐘，個人最佳',   '2025-05-09 16:00:00', '2025-05-09 17:00:00'),
    (10, 10, 10, '發球速度計測 185km/h',             '2025-05-10 09:00:00', '2025-05-10 10:00:00')
  `);

  await db.query(`
    INSERT INTO BODYRECORD (user_id, weight, height, body_fat, recorded_at, record_date) VALUES
    (1, 75.5, 178.0, 15.2, '2025-02-01', '2025-02-01'), (1, 74.8, 178.0, 14.8, '2025-03-01', '2025-03-01'),
    (1, 74.2, 178.0, 14.1, '2025-04-01', '2025-04-01'), (1, 73.5, 178.0, 13.5, '2025-05-01', '2025-05-01'),
    (2, 68.0, 175.0, 12.0, '2025-02-01', '2025-02-01'), (2, 67.5, 175.0, 11.5, '2025-03-01', '2025-03-01'),
    (2, 67.0, 175.0, 11.0, '2025-04-01', '2025-04-01'), (2, 66.5, 175.0, 10.8, '2025-05-01', '2025-05-01'),
    (3, 58.0, 165.0, 20.5, '2025-02-01', '2025-02-01'), (3, 57.5, 165.0, 20.0, '2025-03-01', '2025-03-01'),
    (3, 57.0, 165.0, 19.5, '2025-04-01', '2025-04-01'), (3, 56.5, 165.0, 19.0, '2025-05-01', '2025-05-01'),
    (4, 70.0, 172.0, 16.0, '2025-02-01', '2025-02-01'), (4, 69.5, 172.0, 15.5, '2025-03-01', '2025-03-01'),
    (4, 69.0, 172.0, 15.0, '2025-04-01', '2025-04-01'), (4, 68.5, 172.0, 14.8, '2025-05-01', '2025-05-01'),
    (5, 55.0, 162.0, 22.0, '2025-02-01', '2025-02-01'), (5, 54.5, 162.0, 21.5, '2025-03-01', '2025-03-01'),
    (5, 54.0, 162.0, 21.0, '2025-04-01', '2025-04-01'), (5, 53.5, 162.0, 20.5, '2025-05-01', '2025-05-01'),
    (6, 82.0, 185.0, 14.0, '2025-02-01', '2025-02-01'), (6, 81.5, 185.0, 13.5, '2025-03-01', '2025-03-01'),
    (6, 81.0, 185.0, 13.0, '2025-04-01', '2025-04-01'), (6, 80.5, 185.0, 12.5, '2025-05-01', '2025-05-01'),
    (7, 52.0, 160.0, 24.0, '2025-02-01', '2025-02-01'), (7, 51.5, 160.0, 23.5, '2025-03-01', '2025-03-01'),
    (7, 51.0, 160.0, 23.0, '2025-04-01', '2025-04-01'), (7, 50.5, 160.0, 22.5, '2025-05-01', '2025-05-01'),
    (8, 72.0, 174.0, 17.0, '2025-02-01', '2025-02-01'), (8, 71.5, 174.0, 16.5, '2025-03-01', '2025-03-01'),
    (8, 71.0, 174.0, 16.0, '2025-04-01', '2025-04-01'), (8, 70.5, 174.0, 15.5, '2025-05-01', '2025-05-01'),
    (9, 65.0, 170.0, 13.0, '2025-02-01', '2025-02-01'), (9, 64.5, 170.0, 12.5, '2025-03-01', '2025-03-01'),
    (9, 64.0, 170.0, 12.0, '2025-04-01', '2025-04-01'), (9, 63.5, 170.0, 11.5, '2025-05-01', '2025-05-01'),
    (10,71.0, 176.0, 15.5, '2025-02-01', '2025-02-01'), (10,70.5, 176.0, 15.0, '2025-03-01', '2025-03-01'),
    (10,70.0, 176.0, 14.5, '2025-04-01', '2025-04-01'), (10,69.5, 176.0, 14.0, '2025-05-01', '2025-05-01')
  `);

  await db.query(`
    INSERT INTO POST (post_id, user_id, board_id, title, post_type, content, image_url, created_at) VALUES
    (1,  1,  1, '籃球三分線訓練心得',         'general', '今天練了兩小時三分線，命中率從 30% 提升到 45%，關鍵在於出手點要一致。',          NULL, '2025-05-01 20:00:00'),
    (2,  2,  2, '台北馬拉松備戰週記 #1',      'general', '第一週完成 60km 週跑量，比預計多 10km，身體恢復狀況良好。',                     NULL, '2025-05-02 21:00:00'),
    (3,  3,  3, '自由式換氣技巧分享',         'general', '很多初學者換氣時頭抬太高，導致身體下沉。正確方式是頭部旋轉，嘴巴剛好到水面。',  NULL, '2025-05-03 19:00:00'),
    (4,  4,  4, '羽球正手殺球教學',           'general', '殺球的力量來自全身轉動，不是只有手臂。重點是引拍、轉腰、爆發的連貫動作。',      NULL, '2025-05-04 20:00:00'),
    (5,  5,  5, '陽明山爬坡騎乘紀錄',         'general', '今天挑戰陽明山，從士林到竹子湖全長 15km，爬升 600m，花了 2 小時。',             NULL, '2025-05-05 18:00:00'),
    (6,  6,  1, '籃球場地推薦：大安運動中心', 'general', '大安運動中心的室內籃球場品質很好，木地板、冷氣，假日需要提前預約。',           NULL, '2025-05-06 22:00:00'),
    (7,  7,  7, '女生重訓入門推薦動作',       'general', '剛開始重訓不用追求大重量，先把動作模式練好。推薦：深蹲、硬舉、划船、臥推。',    NULL, '2025-05-07 19:00:00'),
    (8,  8,  6, '五人制足球組隊心得',         'general', '打了三年五人制，最重要的是默契，不是個人技術。找到信任的隊友才是關鍵。',        NULL, '2025-05-08 21:00:00'),
    (9,  9,  8, '攀岩新手入門指南',           'general', '第一次去室內攀岩不用擔心，教練會教基本技巧，難度從 5.6 開始很友善。',           NULL, '2025-05-09 20:00:00'),
    (10, 10, 9, '網球反手拍改善紀錄',         'general', '跟教練上了 10 堂課，反手拍從常常打出界到可以穩定落點，進步很有成就感。',        NULL, '2025-05-10 19:00:00'),
    (11, 1,  7, '重訓補給品選擇心得',         'general', '蛋白粉選分離乳清，肌酸補充在訓練前後各 5g，這兩樣就夠了，不用買太多。',         NULL, '2025-05-11 20:00:00'),
    (12, 2,  2, '間歇跑入門：400m x 8 組',    'general', '間歇跑最難的是配速控制，每組 400m 目標 90 秒，中間休息 60 秒。',              NULL, '2025-05-12 21:00:00'),
    (13, 3,  3, '開放水域游泳注意事項',       'general', '開放水域和泳池很不一樣，水流、能見度、溫度都要注意，建議先跟有經驗的人去。',    NULL, '2025-05-13 20:00:00'),
    (14, 6,  1, '台北籃球聯賽報名資訊',       'general', '台北市業餘籃球聯賽開放報名，4 月底截止，有興趣的隊伍可以留言詢問。',            NULL, '2025-05-14 19:00:00'),
    (15, 7,  7, '深蹲動作常見錯誤',           'general', '常見錯誤：膝蓋內扣、背部圓背、腳跟抬起。建議先從徒手深蹲練習，確認動作後再加重。', NULL, '2025-05-15 20:00:00')
  `);

  await db.query(`
    INSERT INTO COMMENT (comment_id, user_id, post_id, content, created_at) VALUES
    (1,  2,  1,  '三分線訓練真的要靠量的累積，加油！',              '2025-05-01 20:30:00'),
    (2,  6,  1,  '出手點一致是關鍵，我也是這樣練的。',               '2025-05-01 21:00:00'),
    (3,  1,  2,  '週跑量 60km 很猛，注意不要受傷。',                 '2025-05-02 21:30:00'),
    (4,  5,  2,  '馬拉松備戰加油！記得補充電解質。',                 '2025-05-02 22:00:00'),
    (5,  4,  3,  '這個換氣技巧我一直做錯，謝謝分享！',               '2025-05-03 19:30:00'),
    (6,  1,  4,  '羽球殺球真的要靠轉腰，純手臂根本沒力。',           '2025-05-04 20:30:00'),
    (7,  3,  5,  '陽明山很猛，我騎了一半就放棄了哈哈。',             '2025-05-05 18:30:00'),
    (8,  2,  6,  '大安那個場地我去過，真的不錯！',                   '2025-05-06 22:30:00'),
    (9,  1,  7,  '深蹲真的最重要，做對了之後其他動作都進步很快。',   '2025-05-07 19:30:00'),
    (10, 5,  7,  '推薦可以加上臀推，對臀部很有效。',                 '2025-05-07 20:00:00'),
    (11, 1,  8,  '五人制默契真的很重要，同意！',                     '2025-05-08 21:30:00'),
    (12, 4,  9,  '攀岩好有趣，下次想跟你去！',                       '2025-05-09 20:30:00'),
    (13, 8,  10, '網球有教練帶進步真的快很多。',                     '2025-05-10 19:30:00'),
    (14, 7,  11, '蛋白粉推薦哪個牌子？',                             '2025-05-11 20:30:00'),
    (15, 1,  14, '想報名！請問有缺球員嗎？',                         '2025-05-14 19:30:00'),
    (16, 6,  14, '我們隊也想參加，名額還有嗎？',                     '2025-05-14 20:00:00'),
    (17, 3,  12, '400m x 8 組好硬，我只能做 5 組。',                 '2025-05-12 21:30:00'),
    (18, 9,  15, '深蹲圓背真的很危險，謝謝提醒。',                   '2025-05-15 20:30:00'),
    (19, 10, 13, '開放水域的洋流也要注意，曾經游偏很多。',           '2025-05-13 20:30:00'),
    (20, 2,  11, 'ISO 分離乳清吸收比較好嗎？',                       '2025-05-11 21:00:00')
  `);

  await db.query(`
    INSERT INTO POSTLIKE (user_id, post_id, created_at) VALUES
    (2, 1, '2025-05-01 20:15:00'), (3, 1, '2025-05-01 20:20:00'), (4, 1, '2025-05-01 20:25:00'),
    (5, 1, '2025-05-01 20:30:00'), (6, 1, '2025-05-01 21:00:00'),
    (1, 2, '2025-05-02 21:10:00'), (3, 2, '2025-05-02 21:20:00'), (4, 2, '2025-05-02 21:30:00'),
    (1, 3, '2025-05-03 19:10:00'), (2, 3, '2025-05-03 19:20:00'), (5, 3, '2025-05-03 19:30:00'),
    (1, 4, '2025-05-04 20:10:00'), (2, 4, '2025-05-04 20:20:00'),
    (1, 5, '2025-05-05 18:10:00'), (2, 5, '2025-05-05 18:20:00'), (3, 5, '2025-05-05 18:30:00'),
    (1, 7, '2025-05-07 19:10:00'), (2, 7, '2025-05-07 19:20:00'), (3, 7, '2025-05-07 19:30:00'), (4, 7, '2025-05-07 19:40:00'),
    (1, 15,'2025-05-15 20:10:00'), (2, 15,'2025-05-15 20:20:00'), (3, 15,'2025-05-15 20:30:00'),
    (5, 11,'2025-05-11 20:10:00'), (6, 11,'2025-05-11 20:20:00')
  `);

  await db.query(`
    INSERT INTO POSTBOOKMARK (user_id, post_id, saved_at) VALUES
    (1, 3,  '2025-05-03 20:00:00'), (1, 7,  '2025-05-07 20:00:00'),
    (2, 7,  '2025-05-07 21:00:00'), (2, 15, '2025-05-15 21:00:00'),
    (3, 1,  '2025-05-01 22:00:00'), (4, 2,  '2025-05-02 22:00:00'),
    (5, 7,  '2025-05-07 22:00:00'), (6, 14, '2025-05-14 21:00:00'),
    (7, 11, '2025-05-11 21:00:00'), (8, 8,  '2025-05-08 22:00:00')
  `);

  await db.query(`
    INSERT INTO WORKOUTPLANSAVE (user_id, plan_id, created_at) VALUES
    (2, 1,  '2025-05-01 21:00:00'),
    (3, 2,  '2025-05-02 22:00:00'),
    (4, 3,  '2025-05-03 21:00:00'),
    (1, 2,  '2025-05-04 21:00:00'),
    (5, 2,  '2025-05-05 21:00:00'),
    (6, 7,  '2025-05-07 21:00:00'),
    (7, 1,  '2025-05-08 21:00:00'),
    (8, 6,  '2025-05-09 21:00:00')
  `);

  await db.query(`
    INSERT INTO USERFOLLOW (follower_id, followee_id, created_at) VALUES
    (1, 2, '2025-03-01'), (1, 6, '2025-03-02'), (1, 7, '2025-03-03'),
    (2, 1, '2025-03-01'), (2, 3, '2025-03-05'),
    (3, 1, '2025-03-10'), (3, 5, '2025-03-11'),
    (4, 1, '2025-03-15'), (4, 10,'2025-03-16'),
    (5, 3, '2025-03-20'), (6, 1, '2025-03-25'),
    (7, 1, '2025-04-01')
  `);

  // location_point 由 BEFORE INSERT trigger 自動計算
  await db.query(`
    INSERT INTO WORKOUTINVITATION (invitation_id, user_id, board_id, title, location, event_time, max_participants, latitude, longitude, required_skill_level, created_at) VALUES
    (1, 1,  1, '週六下午籃球三對三',   '大安運動中心籃球場',   '2025-06-07 14:00:00', 6,  25.026667, 121.543611, 3, '2025-05-20 10:00:00'),
    (2, 4,  4, '新莊體育館羽球同好會', '新莊體育館羽球場',     '2025-06-08 10:00:00', 8,  25.042222, 121.449167, 2, '2025-05-21 10:00:00'),
    (3, 2,  2, '河濱公園晨跑揪團',     '大佳河濱公園入口',     '2025-06-09 06:30:00', 10, 25.070556, 121.534722, 2, '2025-05-22 10:00:00'),
    (4, 5,  5, '陽明山週末騎車',       '陽明山遊客中心停車場', '2025-06-14 07:00:00', 6,  25.157500, 121.543056, 3, '2025-05-23 10:00:00'),
    (5, 8,  6, '五人制足球友誼賽',     '南港運動中心足球場',   '2025-06-15 16:00:00', 10, 25.054444, 121.606944, 3, '2025-05-24 10:00:00'),
    (6, 10, 9, '網球單打配對練習',     '信義網球場',           '2025-06-21 09:00:00', 4,  25.035278, 121.567500, 4, '2025-05-25 10:00:00')
  `);

  await db.query(`
    INSERT INTO INVITATIONPARTICIPANT (user_id, invitation_id, status, joined_at) VALUES
    (2, 1, 'confirmed',  '2025-05-20 11:00:00'),
    (6, 1, 'confirmed',  '2025-05-20 12:00:00'),
    (3, 1, 'waitlisted', '2025-05-20 13:00:00'),
    (1, 2, 'confirmed',  '2025-05-21 11:00:00'),
    (5, 2, 'confirmed',  '2025-05-21 12:00:00'),
    (1, 3, 'confirmed',  '2025-05-22 11:00:00'),
    (3, 3, 'confirmed',  '2025-05-22 12:00:00'),
    (7, 3, 'confirmed',  '2025-05-22 13:00:00'),
    (1, 4, 'confirmed',  '2025-05-23 11:00:00'),
    (3, 4, 'confirmed',  '2025-05-23 12:00:00')
  `);

  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('[initDb] seed 完成');
}

module.exports = initDb;
