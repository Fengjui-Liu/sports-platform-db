-- 1. 更新使用者表：增加技能等級
ALTER TABLE USER
ADD COLUMN IF NOT EXISTS skill_levels JSON DEFAULT NULL;

-- 2. 更新揪團表：增加空間座標與要求的技能等級
ALTER TABLE WORKOUTINVITATION
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS required_skill_level INT DEFAULT 1;

-- 3. 增加空間座標點 (容許舊資料沒有經緯度)
ALTER TABLE WORKOUTINVITATION
ADD COLUMN IF NOT EXISTS location_point POINT AS (ST_PointFromText(CONCAT('POINT(', COALESCE(longitude, 0), ' ', COALESCE(latitude, 0), ')'), 4326)) STORED NULL;

-- 4. 建立空間索引與常用查詢索引
CREATE SPATIAL INDEX IF NOT EXISTS idx_invitation_location ON WORKOUTINVITATION (location_point);
CREATE INDEX IF NOT EXISTS idx_invitation_time ON WORKOUTINVITATION (event_time);
CREATE INDEX IF NOT EXISTS idx_invitation_skill ON WORKOUTINVITATION (required_skill_level);

-- 5. 更新參與者表：增加候補狀態機制
ALTER TABLE INVITATIONPARTICIPANT
ADD COLUMN IF NOT EXISTS status ENUM('confirmed', 'waitlisted', 'cancelled') DEFAULT 'confirmed';
CREATE INDEX IF NOT EXISTS idx_participant_status ON INVITATIONPARTICIPANT (status);

-- 6. 動態牆效能優化索引
CREATE INDEX IF NOT EXISTS idx_post_feed ON POST (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_lookup ON COMMENT (post_id, created_at ASC);
