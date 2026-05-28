-- 1. 更新使用者表：增加技能等級
ALTER TABLE USER 
ADD COLUMN skill_levels JSON DEFAULT NULL;

-- 2. 更新揪團表：增加空間座標與要求的技能等級
ALTER TABLE WORKOUTINVITATION 
ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL,
ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL,
ADD COLUMN required_skill_level INT DEFAULT 1;

-- 3. 增加空間座標點 (容許舊資料沒有經緯度)
ALTER TABLE WORKOUTINVITATION
ADD COLUMN location_point POINT AS (ST_PointFromText(CONCAT('POINT(', COALESCE(longitude, 0), ' ', COALESCE(latitude, 0), ')'), 4326)) STORED NULL;

-- 4. 建立空間索引與常用查詢索引
CREATE SPATIAL INDEX idx_invitation_location ON WORKOUTINVITATION (location_point);
CREATE INDEX idx_invitation_time ON WORKOUTINVITATION (event_time);
CREATE INDEX idx_invitation_skill ON WORKOUTINVITATION (required_skill_level);

-- 5. 更新參與者表：增加候補狀態機制
ALTER TABLE INVITATIONPARTICIPANT 
ADD COLUMN status ENUM('confirmed', 'waitlisted', 'cancelled') DEFAULT 'confirmed',
ADD INDEX idx_participant_status (status);

-- 6. 動態牆效能優化索引
CREATE INDEX idx_post_feed ON POST (board_id, created_at DESC);
CREATE INDEX idx_comment_lookup ON COMMENT (post_id, created_at ASC);
