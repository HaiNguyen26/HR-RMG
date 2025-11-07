-- ============================================
-- HR Management System - Update Request Items Tracking
-- ============================================
-- Cập nhật để theo dõi chi tiết từng item trong request
-- ============================================

-- Bảng: request_items (Chi tiết từng item trong request)
CREATE TABLE IF NOT EXISTS request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    quantity_provided INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    provided_by INTEGER REFERENCES users(id),
    provided_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_status ON request_items(status);

-- Comments
COMMENT ON TABLE request_items IS 'Bảng lưu trữ chi tiết từng item trong yêu cầu';
COMMENT ON COLUMN request_items.quantity IS 'Số lượng yêu cầu';
COMMENT ON COLUMN request_items.quantity_provided IS 'Số lượng đã cung cấp';
COMMENT ON COLUMN request_items.status IS 'Trạng thái: PENDING, PARTIAL, COMPLETED, CANCELLED';

-- Trigger để tự động update updated_at
CREATE TRIGGER update_request_items_updated_at BEFORE UPDATE ON request_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function để cập nhật status của request dựa trên request_items
CREATE OR REPLACE FUNCTION update_request_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    request_record RECORD;
    total_items INT;
    completed_items INT;
    partial_items INT;
    pending_items INT;
    new_status VARCHAR(20);
BEGIN
    -- Lấy thông tin request
    SELECT * INTO request_record FROM requests WHERE id = NEW.request_id;
    
    -- Đếm số lượng items theo trạng thái
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'PARTIAL') as partial,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending
    INTO total_items, completed_items, partial_items, pending_items
    FROM request_items
    WHERE request_id = NEW.request_id;
    
    -- Xác định trạng thái mới của request
    -- Nếu tất cả items đã COMPLETED -> COMPLETED
    -- Nếu có items chưa đủ (PARTIAL hoặc PENDING) -> PENDING (reset về trạng thái ban đầu)
    -- Nếu đang có items đã cung cấp một phần nhưng chưa đủ -> IN_PROGRESS
    IF completed_items = total_items AND total_items > 0 THEN
        new_status := 'COMPLETED';
    ELSIF partial_items > 0 AND completed_items < total_items THEN
        -- Có items đang cung cấp một phần nhưng chưa đủ -> IN_PROGRESS
        new_status := 'IN_PROGRESS';
    ELSIF pending_items > 0 OR (completed_items < total_items AND partial_items = 0) THEN
        -- Có items chưa được cung cấp hoặc chưa đủ -> PENDING (reset về trạng thái ban đầu)
        new_status := 'PENDING';
    ELSE
        new_status := request_record.status; -- Giữ nguyên nếu không xác định được
    END IF;
    
    -- Cập nhật status của request nếu có thay đổi
    IF new_status != request_record.status THEN
        UPDATE requests 
        SET status = new_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.request_id;
        
        -- Nếu completed, set completed_at
        IF new_status = 'COMPLETED' THEN
            UPDATE requests 
            SET completed_at = CURRENT_TIMESTAMP
            WHERE id = NEW.request_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để tự động cập nhật status của request khi item thay đổi
CREATE TRIGGER trg_update_request_status_from_items
    AFTER INSERT OR UPDATE ON request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_request_status_from_items();

-- Function để tạo thông báo khi item được cập nhật
CREATE OR REPLACE FUNCTION create_item_update_notification()
RETURNS TRIGGER AS $$
DECLARE
    request_record RECORD;
    item_status_label VARCHAR(50);
BEGIN
    -- Lấy thông tin request
    SELECT * INTO request_record FROM requests WHERE id = NEW.request_id;
    
    -- Xác định label cho status
    CASE NEW.status
        WHEN 'COMPLETED' THEN item_status_label := 'đã hoàn thành';
        WHEN 'PARTIAL' THEN item_status_label := 'đã cung cấp một phần';
        WHEN 'CANCELLED' THEN item_status_label := 'đã hủy';
        ELSE item_status_label := 'đã được cập nhật';
    END CASE;
    
    -- Thông báo cho HR (người tạo request)
    IF request_record.requested_by IS NOT NULL AND OLD.status != NEW.status THEN
        INSERT INTO notifications (user_id, request_id, type, title, message)
        VALUES (
            request_record.requested_by,
            NEW.request_id,
            'REQUEST_UPDATED',
            'Cập nhật item trong yêu cầu',
            'Item "' || NEW.item_name || '" trong yêu cầu #' || NEW.request_id || ' ' || item_status_label || ' (Số lượng: ' || NEW.quantity_provided || '/' || NEW.quantity || ')'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để tạo thông báo khi item được cập nhật
CREATE TRIGGER trg_create_item_update_notification
    AFTER UPDATE ON request_items
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.quantity_provided IS DISTINCT FROM NEW.quantity_provided)
    EXECUTE FUNCTION create_item_update_notification();

-- View: Request với thông tin chi tiết items
CREATE OR REPLACE VIEW v_requests_with_items AS
SELECT 
    r.id as request_id,
    r.employee_id,
    r.request_type,
    r.target_department,
    r.title,
    r.description,
    r.status as request_status,
    r.priority,
    r.requested_by,
    r.assigned_to,
    r.completed_at,
    r.notes as request_notes,
    r.created_at as request_created_at,
    r.updated_at as request_updated_at,
    e.ho_ten as employee_name,
    e.email as employee_email,
    e.ma_nhan_vien,
    u1.ho_ten as requested_by_name,
    u2.ho_ten as assigned_to_name,
    COUNT(ri.id) as total_items,
    COUNT(ri.id) FILTER (WHERE ri.status = 'COMPLETED') as completed_items,
    COUNT(ri.id) FILTER (WHERE ri.status = 'PARTIAL') as partial_items,
    COUNT(ri.id) FILTER (WHERE ri.status = 'PENDING') as pending_items,
    SUM(ri.quantity) as total_quantity,
    SUM(ri.quantity_provided) as total_provided
FROM requests r
LEFT JOIN employees e ON r.employee_id = e.id
LEFT JOIN users u1 ON r.requested_by = u1.id
LEFT JOIN users u2 ON r.assigned_to = u2.id
LEFT JOIN request_items ri ON r.id = ri.request_id
GROUP BY r.id, e.id, u1.id, u2.id;

-- View: Chi tiết items của request
CREATE OR REPLACE VIEW v_request_items_detail AS
SELECT 
    ri.*,
    r.title as request_title,
    r.target_department,
    r.employee_id,
    e.ho_ten as employee_name,
    u1.ho_ten as provided_by_name,
    CASE 
        WHEN ri.quantity_provided = 0 THEN 'Chưa cung cấp'
        WHEN ri.quantity_provided = ri.quantity THEN 'Đã cung cấp đủ'
        WHEN ri.quantity_provided < ri.quantity THEN 'Đã cung cấp một phần'
        ELSE 'Đã cung cấp vượt mức'
    END as provision_status
FROM request_items ri
LEFT JOIN requests r ON ri.request_id = r.id
LEFT JOIN employees e ON r.employee_id = e.id
LEFT JOIN users u1 ON ri.provided_by = u1.id;

