-- Script to drop notifications table and all related objects
-- Run this script if you want to completely remove the notification system

-- Drop indexes first
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_employee_id;
DROP INDEX IF EXISTS idx_notifications_candidate_id;
DROP INDEX IF EXISTS idx_notifications_request_id;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Drop the notifications table
DROP TABLE IF EXISTS notifications CASCADE;

-- Note: This will also drop any foreign key constraints
-- If you get foreign key errors, you may need to drop dependent objects first

