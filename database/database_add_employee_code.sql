-- ============================================
-- Thêm cột mã nhân viên vào bảng employees
-- ============================================

-- Thêm cột ma_nhan_vien
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS ma_nhan_vien VARCHAR(20) UNIQUE;

-- Tạo index cho ma_nhan_vien
CREATE INDEX IF NOT EXISTS idx_employees_ma_nhan_vien ON employees(ma_nhan_vien);

-- Comment
COMMENT ON COLUMN employees.ma_nhan_vien IS 'Mã nhân viên duy nhất (VD: NV001, NV002, ...)';

-- Tạo function để generate mã nhân viên tự động
CREATE OR REPLACE FUNCTION generate_ma_nhan_vien()
RETURNS TRIGGER AS $$
DECLARE
    next_id INTEGER;
    new_code VARCHAR(20);
BEGIN
    -- Nếu mã nhân viên chưa được set, tạo mã mới
    IF NEW.ma_nhan_vien IS NULL THEN
        -- Lấy ID tiếp theo từ sequence
        next_id := NEW.id;
        -- Tạo mã nhân viên: NV + số có 4 chữ số (VD: NV0001, NV0002)
        new_code := 'NV' || LPAD(next_id::TEXT, 4, '0');
        NEW.ma_nhan_vien := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger để tự động generate mã nhân viên
DROP TRIGGER IF EXISTS trigger_generate_ma_nhan_vien ON employees;
CREATE TRIGGER trigger_generate_ma_nhan_vien
    BEFORE INSERT ON employees
    FOR EACH ROW
    EXECUTE FUNCTION generate_ma_nhan_vien();

-- Cập nhật mã nhân viên cho các nhân viên hiện có (nếu có)
UPDATE employees 
SET ma_nhan_vien = 'NV' || LPAD(id::TEXT, 4, '0')
WHERE ma_nhan_vien IS NULL;

-- Kiểm tra
SELECT id, ma_nhan_vien, ho_ten, email FROM employees ORDER BY id;

