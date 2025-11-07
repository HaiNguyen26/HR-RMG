CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('LEAVE', 'RESIGN')),
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CANCELLED', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE leave_requests
    DROP CONSTRAINT IF EXISTS leave_requests_manager_id_fkey;

ALTER TABLE leave_requests
    ADD CONSTRAINT leave_requests_manager_id_fkey
    FOREIGN KEY (manager_id)
    REFERENCES employees(id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_manager ON leave_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

CREATE TRIGGER trg_leave_requests_updated
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

