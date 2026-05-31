-- SportBoard Schema v3.0（更新日期：2026-05-31）

SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER IF EXISTS workoutinvitation_location_bi;
DROP TRIGGER IF EXISTS workoutinvitation_location_bu;

DROP TABLE IF EXISTS USERFOLLOW;
DROP TABLE IF EXISTS INVITATIONPARTICIPANT;
DROP TABLE IF EXISTS POSTBOOKMARK;
DROP TABLE IF EXISTS WORKOUTPLANSAVE;
DROP TABLE IF EXISTS POSTLIKE;
DROP TABLE IF EXISTS WORKOUTINVITATION;
DROP TABLE IF EXISTS COMMENT;
DROP TABLE IF EXISTS POST;
DROP TABLE IF EXISTS WORKOUTSESSION;
DROP TABLE IF EXISTS WORKOUTPLAN;
DROP TABLE IF EXISTS SPORTBOARD;
DROP TABLE IF EXISTS BODYRECORD;
DROP TABLE IF EXISTS USER;

CREATE TABLE IF NOT EXISTS USER (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(16) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  bio TEXT,
  profile_image VARCHAR(255),
  skill_levels JSON DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS BODYRECORD (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  height DECIMAL(5,2) NOT NULL,
  body_fat DECIMAL(5,2) NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_date DATE NOT NULL,
  INDEX idx_bodyrecord_user_recorded (user_id, recorded_at, record_id),
  CONSTRAINT fk_bodyrecord_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SPORTBOARD (
  board_id INT AUTO_INCREMENT PRIMARY KEY,
  sport_type VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  `sets` INT NOT NULL,
  target_distance DECIMAL(6,2) DEFAULT NULL,
  target_duration INT DEFAULT NULL,
  rounds INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workoutplan_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS WORKOUTSESSION (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  notes TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  CONSTRAINT fk_workoutsession_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_workoutsession_plan FOREIGN KEY (plan_id) REFERENCES WORKOUTPLAN(plan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS POST (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  board_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  post_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL,
  INDEX idx_post_feed (board_id, created_at DESC),
  CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_post_board FOREIGN KEY (board_id) REFERENCES SPORTBOARD(board_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS COMMENT (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comment_lookup (post_id, created_at ASC),
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS POSTLIKE (
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  INDEX idx_postlike_post_created (post_id, created_at),
  CONSTRAINT fk_postlike_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE,
  CONSTRAINT fk_postlike_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS POSTBOOKMARK (
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  INDEX idx_postbookmark_post (post_id),
  INDEX idx_postbookmark_user (user_id),
  CONSTRAINT fk_postbookmark_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_postbookmark_post FOREIGN KEY (post_id) REFERENCES POST(post_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS WORKOUTPLANSAVE (
  plan_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id, user_id),
  CONSTRAINT fk_workoutplansave_plan FOREIGN KEY (plan_id) REFERENCES WORKOUTPLAN(plan_id) ON DELETE CASCADE,
  CONSTRAINT fk_workoutplansave_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS INVITATIONPARTICIPANT (
  invitation_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('confirmed', 'waitlisted', 'cancelled') DEFAULT 'confirmed',
  PRIMARY KEY (invitation_id, user_id),
  INDEX idx_participant_status (status),
  CONSTRAINT fk_invitationparticipant_invitation FOREIGN KEY (invitation_id) REFERENCES WORKOUTINVITATION(invitation_id) ON DELETE CASCADE,
  CONSTRAINT fk_invitationparticipant_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

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
);

SET FOREIGN_KEY_CHECKS = 1;

DELIMITER //

CREATE TRIGGER workoutinvitation_location_bi
BEFORE INSERT ON WORKOUTINVITATION
FOR EACH ROW
BEGIN
  SET NEW.location_point = ST_PointFromText(
    CONCAT('POINT(', COALESCE(NEW.longitude, 0), ' ', COALESCE(NEW.latitude, 0), ')'),
    4326
  );
END //

CREATE TRIGGER workoutinvitation_location_bu
BEFORE UPDATE ON WORKOUTINVITATION
FOR EACH ROW
BEGIN
  SET NEW.location_point = ST_PointFromText(
    CONCAT('POINT(', COALESCE(NEW.longitude, 0), ' ', COALESCE(NEW.latitude, 0), ')'),
    4326
  );
END //

DELIMITER ;
