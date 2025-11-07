-- ============================================
-- Update Request Status Logic
-- ============================================
-- Cập nhật logic để reset status về PENDING khi items chưa đủ
-- ============================================

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
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND quantity_provided >= quantity) as completed,
        COUNT(*) FILTER (WHERE status = 'PARTIAL' OR (quantity_provided > 0 AND quantity_provided < quantity)) as partial,
        COUNT(*) FILTER (WHERE status = 'PENDING' OR quantity_provided = 0) as pending
    INTO total_items, completed_items, partial_items, pending_items
    FROM request_items
    WHERE request_id = NEW.request_id;
    
    -- Xác định trạng thái mới của request
    -- Nếu tất cả items đã COMPLETED (quantity_provided >= quantity) -> COMPLETED
    -- Nếu có items đang cung cấp một phần nhưng chưa đủ -> IN_PROGRESS
    -- Nếu có items chưa được cung cấp hoặc chưa đủ -> PENDING (reset về trạng thái ban đầu)
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
            updated_at = CURRENT_TIMESTAMP,
            completed_at = CASE 
                WHEN new_status = 'COMPLETED' THEN CURRENT_TIMESTAMP
                ELSE NULL
            END
        WHERE id = NEW.request_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

