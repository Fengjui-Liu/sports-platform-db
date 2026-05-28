-- 1. 重新建立符合空間索引規範的 location_point (強制 NOT NULL)
ALTER TABLE WORKOUTINVITATION DROP COLUMN IF EXISTS location_point;

ALTER TABLE WORKOUTINVITATION
ADD COLUMN IF NOT EXISTS location_point POINT AS (ST_PointFromText(CONCAT('POINT(', COALESCE(longitude, 0), ' ', COALESCE(latitude, 0), ')'), 4326)) STORED NOT NULL;

-- 2. 建立空間索引與常用查詢索引
CREATE SPATIAL INDEX IF NOT EXISTS idx_invitation_location ON WORKOUTINVITATION (location_point);
CREATE INDEX IF NOT EXISTS idx_invitation_time ON WORKOUTINVITATION (event_time);
CREATE INDEX IF NOT EXISTS idx_invitation_skill ON WORKOUTINVITATION (required_skill_level);

-- 3. 更新參與者表：增加候補狀態機制
ALTER TABLE INVITATIONPARTICIPANT
ADD COLUMN IF NOT EXISTS status ENUM('confirmed', 'waitlisted', 'cancelled') DEFAULT 'confirmed';
CREATE INDEX IF NOT EXISTS idx_participant_status ON INVITATIONPARTICIPANT (status);

-- 4. 動態牆效能優化索引
CREATE INDEX IF NOT EXISTS idx_post_feed ON POST (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_lookup ON COMMENT (post_id, created_at ASC);
