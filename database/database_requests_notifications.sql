-- ============================================
-- HR Management System - Requests & Notifications
-- ============================================
-- Bảng lưu trữ yêu cầu từ HR đến các phòng ban
-- ============================================

-- Bảng: requests (Yêu cầu từ HR)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('IT_EQUIPMENT', 'OFFICE_SUPPLIES', 'ACCOUNTING', 'OTHER')),
    target_department VARCHAR(20) NOT NULL CHECK (target_department IN ('IT', 'HR', 'ACCOUNTING', 'OTHER')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB, -- Lưu danh sách vật dụng/thiết bị yêu cầu
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    requested_by INTEGER REFERENCES users(id), -- HR user tạo yêu cầu
    assigned_to INTEGER REFERENCES users(id), -- User phòng ban xử lý
    completed_at TIMESTAMP NULL,
    notes TEXT, -- Ghi chú từ phòng ban xử lý
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_target_department ON requests(target_department);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_request_type ON requests(request_type);
CREATE INDEX IF NOT EXISTS idx_requests_requested_by ON requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

-- Comments
COMMENT ON TABLE requests IS 'Bảng lưu trữ yêu cầu từ HR đến các phòng ban (IT, Hành chính, Kế toán)';
COMMENT ON COLUMN requests.request_type IS 'Loại yêu cầu: IT_EQUIPMENT, OFFICE_SUPPLIES, ACCOUNTING, OTHER';
COMMENT ON COLUMN requests.target_department IS 'Phòng ban nhận yêu cầu: IT, HR, ACCOUNTING, OTHER';
COMMENT ON COLUMN requests.items IS 'JSON array chứa danh sách vật dụng/thiết bị yêu cầu';
COMMENT ON COLUMN requests.status IS 'Trạng thái: PENDING, APPROVED, IN_PROGRESS, COMPLETED, REJECTED';

-- Bảng: notifications (Thông báo cho người dùng)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('NEW_REQUEST', 'REQUEST_UPDATED', 'REQUEST_COMPLETED', 'SYSTEM')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Comments
COMMENT ON TABLE notifications IS 'Bảng lưu trữ thông báo cho người dùng';
COMMENT ON COLUMN notifications.type IS 'Loại thông báo: NEW_REQUEST, REQUEST_UPDATED, REQUEST_COMPLETED, SYSTEM';

-- Trigger để tự động update updated_at
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function để tạo thông báo khi có request mới
CREATE OR REPLACE FUNCTION create_request_notification()
RETURNS TRIGGER AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Tạo thông báo cho tất cả users của phòng ban target
    FOR user_record IN 
        SELECT id FROM users
        WHERE role = NEW.target_department
          AND trang_thai = 'ACTIVE'
    LOOP
        INSERT INTO notifications (user_id, request_id, type, title, message)
        VALUES (
            user_record.id,
            NEW.id,
            'NEW_REQUEST',
            'Yêu cầu mới từ HR',
            'Có yêu cầu mới: ' || NEW.title || ' cho nhân viên #' || NEW.employee_id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để tạo thông báo khi có request mới
CREATE TRIGGER trg_create_request_notification
    AFTER INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION create_request_notification();

-- Function để tạo thông báo khi request được cập nhật
CREATE OR REPLACE FUNCTION update_request_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Nếu status thay đổi, tạo thông báo cho HR
    IF NEW.status != OLD.status THEN
        -- Thông báo cho người tạo request (HR)
        IF NEW.requested_by IS NOT NULL THEN
            INSERT INTO notifications (user_id, request_id, type, title, message)
            VALUES (
                NEW.requested_by,
                NEW.id,
                'REQUEST_UPDATED',
                'Yêu cầu đã được cập nhật',
                'Yêu cầu #' || NEW.id || ' đã chuyển sang trạng thái: ' || NEW.status
            );
        END IF;
        
        -- Nếu completed, thông báo cho HR
        IF NEW.status = 'COMPLETED' THEN
            IF NEW.requested_by IS NOT NULL THEN
                INSERT INTO notifications (user_id, request_id, type, title, message)
                VALUES (
                    NEW.requested_by,
                    NEW.id,
                    'REQUEST_COMPLETED',
                    'Yêu cầu đã hoàn thành',
                    'Yêu cầu #' || NEW.id || ': ' || NEW.title || ' đã hoàn thành'
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để tạo thông báo khi request được cập nhật
CREATE TRIGGER trg_update_request_notification
    AFTER UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_request_notification();

-- View: Danh sách requests với thông tin nhân viên
CREATE OR REPLACE VIEW v_requests_with_employee AS
SELECT 
    r.id,
    r.employee_id,
    r.request_type,
    r.target_department,
    r.title,
    r.description,
    r.items,
    r.status,
    r.priority,
    r.requested_by,
    r.assigned_to,
    r.completed_at,
    r.notes,
    r.created_at,
    r.updated_at,
    e.ho_ten as employee_name,
    e.email as employee_email,
    e.ma_nhan_vien,
    u1.ho_ten as requested_by_name,
    u2.ho_ten as assigned_to_name
FROM requests r
LEFT JOIN employees e ON r.employee_id = e.id
LEFT JOIN users u1 ON r.requested_by = u1.id
LEFT JOIN users u2 ON r.assigned_to = u2.id;

-- View: Thống kê requests theo phòng ban
CREATE OR REPLACE VIEW v_requests_statistics AS
SELECT 
    target_department,
    status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as count_last_7_days,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as count_last_30_days
FROM requests
GROUP BY target_department, status;

