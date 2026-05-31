ALTER TABLE BODYRECORD
  MODIFY COLUMN recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

SET @has_unique_user_record_date = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'BODYRECORD'
    AND INDEX_NAME = 'unique_user_record_date'
);

SET @drop_unique_user_record_date_sql = IF(
  @has_unique_user_record_date > 0,
  'ALTER TABLE BODYRECORD DROP INDEX unique_user_record_date',
  'SELECT 1'
);

PREPARE drop_unique_user_record_date_stmt FROM @drop_unique_user_record_date_sql;
EXECUTE drop_unique_user_record_date_stmt;
DEALLOCATE PREPARE drop_unique_user_record_date_stmt;

SET @has_idx_bodyrecord_user_recorded = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'BODYRECORD'
    AND INDEX_NAME = 'idx_bodyrecord_user_recorded'
);

SET @create_idx_bodyrecord_user_recorded_sql = IF(
  @has_idx_bodyrecord_user_recorded = 0,
  'CREATE INDEX idx_bodyrecord_user_recorded ON BODYRECORD (user_id, recorded_at, record_id)',
  'SELECT 1'
);

PREPARE create_idx_bodyrecord_user_recorded_stmt FROM @create_idx_bodyrecord_user_recorded_sql;
EXECUTE create_idx_bodyrecord_user_recorded_stmt;
DEALLOCATE PREPARE create_idx_bodyrecord_user_recorded_stmt;
