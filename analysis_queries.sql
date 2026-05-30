-- ============================================================
-- SportBoard 分析查詢
-- 共 5 條，每條都包含 JOIN + GROUP BY 或 Subquery
-- ============================================================


-- ── 查詢 1：各板塊互動熱度排行 ──────────────────────────────
-- 統計每個板塊的貼文數、總按讚數、總留言數
-- 展示：多表 JOIN + GROUP BY + ORDER BY

SELECT
    sb.board_id,
    sb.sport_type,
    COUNT(DISTINCT p.post_id)          AS post_count,
    COUNT(DISTINCT pl.user_id)         AS total_likes,
    COUNT(DISTINCT c.comment_id)       AS total_comments,
    COUNT(DISTINCT pl.user_id) + COUNT(DISTINCT c.comment_id) AS engagement_score
FROM SPORTBOARD sb
LEFT JOIN POST p
    ON p.board_id = sb.board_id
LEFT JOIN POSTLIKE pl
    ON pl.post_id = p.post_id
LEFT JOIN COMMENT c
    ON c.post_id = p.post_id
GROUP BY sb.board_id, sb.sport_type
ORDER BY engagement_score DESC;


-- ── 查詢 2：活躍用戶排行（綜合貢獻分）──────────────────────
-- 發文數 * 3 + 留言數 * 1 + 按讚給出數 * 0.5 + 被追蹤數 * 2
-- 展示：多表 LEFT JOIN + 計算欄位 + Subquery

SELECT
    u.user_id,
    u.username,
    COALESCE(post_stat.post_count, 0)        AS posts,
    COALESCE(comment_stat.comment_count, 0)  AS comments,
    COALESCE(like_stat.like_count, 0)        AS likes_given,
    COALESCE(follow_stat.follower_count, 0)  AS followers,
    ROUND(
        COALESCE(post_stat.post_count, 0)       * 3   +
        COALESCE(comment_stat.comment_count, 0) * 1   +
        COALESCE(like_stat.like_count, 0)       * 0.5 +
        COALESCE(follow_stat.follower_count, 0) * 2
    , 1) AS activity_score
FROM USER u
LEFT JOIN (
    SELECT user_id, COUNT(*) AS post_count
    FROM POST GROUP BY user_id
) post_stat ON post_stat.user_id = u.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS comment_count
    FROM COMMENT GROUP BY user_id
) comment_stat ON comment_stat.user_id = u.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS like_count
    FROM POSTLIKE GROUP BY user_id
) like_stat ON like_stat.user_id = u.user_id
LEFT JOIN (
    SELECT followee_id, COUNT(*) AS follower_count
    FROM USERFOLLOW GROUP BY followee_id
) follow_stat ON follow_stat.followee_id = u.user_id
ORDER BY activity_score DESC;


-- ── 查詢 3：每位用戶的身體數據變化趨勢 ─────────────────────
-- 計算每位用戶最新體重 vs 最舊體重，得出減重幅度
-- 展示：相關子查詢 + 條件過濾

SELECT
    u.user_id,
    u.username,
    first_rec.weight                         AS initial_weight,
    last_rec.weight                          AS latest_weight,
    ROUND(first_rec.weight - last_rec.weight, 1) AS weight_lost,
    first_rec.recorded_at                    AS start_date,
    last_rec.recorded_at                     AS end_date,
    DATEDIFF(last_rec.recorded_at, first_rec.recorded_at) AS tracking_days
FROM USER u
JOIN BODYRECORD first_rec ON first_rec.record_id = (
    SELECT record_id FROM BODYRECORD
    WHERE user_id = u.user_id
    ORDER BY recorded_at ASC LIMIT 1
)
JOIN BODYRECORD last_rec ON last_rec.record_id = (
    SELECT record_id FROM BODYRECORD
    WHERE user_id = u.user_id
    ORDER BY recorded_at DESC LIMIT 1
)
WHERE first_rec.record_id != last_rec.record_id
ORDER BY weight_lost DESC;


-- ── 查詢 4：熱門訓練計畫（被收藏 + 執行次數）──────────────
-- 統計每個公開計畫被收藏次數與被執行次數，計算熱門分
-- 展示：多表 JOIN + GROUP BY + HAVING + ORDER BY

SELECT
    wp.plan_id,
    wp.title,
    wp.sport_type,
    wp.difficulty_level,
    u.username                                    AS author,
    COUNT(DISTINCT wps.user_id)                   AS save_count,
    COUNT(DISTINCT ws.session_id)                 AS session_count,
    COUNT(DISTINCT wps.user_id) * 2 +
    COUNT(DISTINCT ws.session_id)                 AS popularity_score
FROM WORKOUTPLAN wp
JOIN USER u ON u.user_id = wp.user_id
LEFT JOIN WORKOUTPLANSAVE wps ON wps.plan_id = wp.plan_id
LEFT JOIN WORKOUTSESSION ws  ON ws.plan_id  = wp.plan_id
WHERE wp.is_public = 1
GROUP BY wp.plan_id, wp.title, wp.sport_type, wp.difficulty_level, u.username
HAVING popularity_score > 0
ORDER BY popularity_score DESC;


-- ── 查詢 5：揪團活動報名情況與缺額分析 ─────────────────────
-- 顯示每場揪團的報名人數、候補人數、剩餘名額
-- 展示：條件聚合 + CASE WHEN + JOIN + 時間篩選

SELECT
    wi.invitation_id,
    wi.title,
    wi.location,
    wi.event_time,
    wi.max_participants,
    u.username                                       AS organizer,
    sb.sport_type,
    COUNT(CASE WHEN ip.status = 'confirmed'  THEN 1 END) AS confirmed_count,
    COUNT(CASE WHEN ip.status = 'waitlisted' THEN 1 END) AS waitlist_count,
    wi.max_participants -
        COUNT(CASE WHEN ip.status = 'confirmed' THEN 1 END) AS remaining_spots,
    CASE
        WHEN wi.max_participants - COUNT(CASE WHEN ip.status = 'confirmed' THEN 1 END) <= 0
            THEN '已額滿'
        WHEN wi.max_participants - COUNT(CASE WHEN ip.status = 'confirmed' THEN 1 END) <= 2
            THEN '即將額滿'
        ELSE '報名中'
    END AS status_label
FROM WORKOUTINVITATION wi
JOIN USER u       ON u.user_id    = wi.user_id
JOIN SPORTBOARD sb ON sb.board_id = wi.board_id
LEFT JOIN INVITATIONPARTICIPANT ip ON ip.invitation_id = wi.invitation_id
WHERE wi.event_time > NOW()
GROUP BY
    wi.invitation_id, wi.title, wi.location, wi.event_time,
    wi.max_participants, u.username, sb.sport_type
ORDER BY wi.event_time ASC;
