-- Add and normalize workout plan visibility.
-- 1 = public, 0 = private.

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'WORKOUTPLAN'
    AND COLUMN_NAME = 'is_public'
);

SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE WORKOUTPLAN ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE AFTER title',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE WORKOUTPLAN
SET is_public = TRUE
WHERE is_public IS NULL;

ALTER TABLE WORKOUTPLAN
  MODIFY COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE;
