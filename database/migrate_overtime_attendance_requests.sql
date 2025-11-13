BEGIN;

-- ===========================
-- OVERTIME REQUESTS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS overtime_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    team_lead_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    request_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration TEXT,
    reason TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_TEAM_LEAD',
    team_lead_action VARCHAR(20),
    team_lead_action_at TIMESTAMP,
    team_lead_comment TEXT,
    branch_action VARCHAR(20),
    branch_action_at TIMESTAMP,
    branch_comment TEXT,
    hr_admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    escalated_at TIMESTAMP,
    due_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
    overdue_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'overtime_requests'
          AND constraint_name = 'overtime_requests_status_check'
    ) THEN
        ALTER TABLE overtime_requests DROP CONSTRAINT overtime_requests_status_check;
    END IF;

    ALTER TABLE overtime_requests
        ADD CONSTRAINT overtime_requests_status_check
        CHECK (status IN ('PENDING_TEAM_LEAD', 'PENDING_BRANCH', 'APPROVED', 'REJECTED', 'CANCELLED'));
END
$$;

CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_team_lead ON overtime_requests(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_branch_manager ON overtime_requests(branch_manager_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_due_at
    ON overtime_requests(status, due_at)
    WHERE status = 'PENDING_TEAM_LEAD';

CREATE OR REPLACE FUNCTION update_overtime_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_overtime_requests_updated ON overtime_requests;
CREATE TRIGGER trg_overtime_requests_updated
    BEFORE UPDATE ON overtime_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_overtime_requests_updated_at();

-- ===========================
-- ATTENDANCE ADJUSTMENTS TABLE
-- ===========================
CREATE TABLE IF NOT EXISTS attendance_adjustments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    team_lead_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    adjustment_date DATE NOT NULL,
    check_type VARCHAR(20) NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    reason TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_TEAM_LEAD',
    team_lead_action VARCHAR(20),
    team_lead_action_at TIMESTAMP,
    team_lead_comment TEXT,
    branch_action VARCHAR(20),
    branch_action_at TIMESTAMP,
    branch_comment TEXT,
    hr_admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    escalated_at TIMESTAMP,
    due_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
    overdue_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'attendance_adjustments'
          AND constraint_name = 'attendance_adjustments_check_type_check'
    ) THEN
        ALTER TABLE attendance_adjustments DROP CONSTRAINT attendance_adjustments_check_type_check;
    END IF;

    ALTER TABLE attendance_adjustments
        ADD CONSTRAINT attendance_adjustments_check_type_check
        CHECK (check_type IN ('CHECK_IN', 'CHECK_OUT', 'BOTH'));
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'attendance_adjustments'
          AND constraint_name = 'attendance_adjustments_status_check'
    ) THEN
        ALTER TABLE attendance_adjustments DROP CONSTRAINT attendance_adjustments_status_check;
    END IF;

    ALTER TABLE attendance_adjustments
        ADD CONSTRAINT attendance_adjustments_status_check
        CHECK (status IN ('PENDING_TEAM_LEAD', 'PENDING_BRANCH', 'APPROVED', 'REJECTED', 'CANCELLED'));
END
$$;

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_employee ON attendance_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_team_lead ON attendance_adjustments(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_branch_manager ON attendance_adjustments(branch_manager_id);
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_status ON attendance_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_due_at
    ON attendance_adjustments(status, due_at)
    WHERE status = 'PENDING_TEAM_LEAD';

CREATE OR REPLACE FUNCTION update_attendance_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_adjustments_updated ON attendance_adjustments;
CREATE TRIGGER trg_attendance_adjustments_updated
    BEFORE UPDATE ON attendance_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_adjustments_updated_at();

COMMIT;

