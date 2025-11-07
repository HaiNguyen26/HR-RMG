-- ============================================
-- Cleanup Orphaned Requests
-- ============================================
-- Xóa các requests không có employee (orphaned requests)
-- ============================================

-- Xóa notifications của orphaned requests trước
DELETE FROM notifications 
WHERE request_id IN (
    SELECT id FROM requests 
    WHERE employee_id IS NULL 
    OR employee_id NOT IN (SELECT id FROM employees)
);

-- Xóa request_items của orphaned requests
DELETE FROM request_items 
WHERE request_id IN (
    SELECT id FROM requests 
    WHERE employee_id IS NULL 
    OR employee_id NOT IN (SELECT id FROM employees)
);

-- Xóa orphaned requests
DELETE FROM requests 
WHERE employee_id IS NULL 
OR employee_id NOT IN (SELECT id FROM employees);

-- Thông báo kết quả
DO $$
DECLARE
    deleted_count INT;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Đã xóa % orphaned requests', deleted_count;
END $$;

