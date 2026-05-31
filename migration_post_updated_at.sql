-- Track the last real edit time for posts.
-- Keep existing and newly-created unedited posts as NULL.

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'POST'
    AND COLUMN_NAME = 'updated_at'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE POST ADD COLUMN updated_at DATETIME NULL DEFAULT NULL AFTER created_at',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
