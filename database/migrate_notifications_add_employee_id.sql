BEGIN;

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE notifications
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_user_employee_check;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_employee_check
    CHECK (
        (user_id IS NOT NULL AND employee_id IS NULL)
        OR (user_id IS NULL AND employee_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee_unread ON notifications(employee_id, is_read) WHERE is_read = FALSE;

COMMIT;

