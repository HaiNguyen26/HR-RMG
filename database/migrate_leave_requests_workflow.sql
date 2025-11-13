BEGIN;

-- Ensure leave_requests table exists with base columns
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL DEFAULT 'LEAVE',
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rename manager_id to team_lead_id if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'leave_requests'
          AND column_name = 'manager_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'leave_requests'
          AND column_name = 'team_lead_id'
    ) THEN
        EXECUTE 'ALTER TABLE leave_requests RENAME COLUMN manager_id TO team_lead_id';
    END IF;
END $$;

-- Add missing columns for workflow
ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS branch_manager_id INTEGER,
    ADD COLUMN IF NOT EXISTS hr_admin_user_id INTEGER,
    ADD COLUMN IF NOT EXISTS team_lead_action VARCHAR(20),
    ADD COLUMN IF NOT EXISTS team_lead_action_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS team_lead_comment TEXT,
    ADD COLUMN IF NOT EXISTS branch_action VARCHAR(20),
    ADD COLUMN IF NOT EXISTS branch_action_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS branch_comment TEXT,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS overdue_notified BOOLEAN DEFAULT FALSE;

-- Adjust status constraint to new workflow values
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'leave_requests'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name ILIKE 'leave_requests_status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE leave_requests DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE $sql$
        ALTER TABLE leave_requests
            ADD CONSTRAINT leave_requests_status_check
            CHECK (status IN (
                'PENDING_TEAM_LEAD',
                'PENDING_BRANCH',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            ))
    $sql$;
END $$;

-- Update default status
ALTER TABLE leave_requests
    ALTER COLUMN status SET DEFAULT 'PENDING_TEAM_LEAD';

-- Ensure due_at default is 24h after creation if not provided
ALTER TABLE leave_requests
    ALTER COLUMN due_at SET DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours';

-- Add/refresh foreign keys
ALTER TABLE leave_requests
    DROP CONSTRAINT IF EXISTS leave_requests_branch_manager_id_fkey;

ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_branch_manager_id_fkey
    FOREIGN KEY (branch_manager_id)
    REFERENCES employees(id)
    ON DELETE SET NULL;

ALTER TABLE leave_requests
    DROP CONSTRAINT IF EXISTS leave_requests_team_lead_id_fkey;

ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_team_lead_id_fkey
    FOREIGN KEY (team_lead_id)
    REFERENCES employees(id)
    ON DELETE CASCADE;

ALTER TABLE leave_requests
    DROP CONSTRAINT IF EXISTS leave_requests_hr_admin_user_id_fkey;

ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_hr_admin_user_id_fkey
    FOREIGN KEY (hr_admin_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;

-- Add convenience indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_team_lead
    ON leave_requests(team_lead_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_branch_manager
    ON leave_requests(branch_manager_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status
    ON leave_requests(status);

CREATE INDEX IF NOT EXISTS idx_leave_requests_due_at
    ON leave_requests(status, due_at)
    WHERE status = 'PENDING_TEAM_LEAD';

COMMIT;

