BEGIN;

-- Bỏ bắt buộc với cột email để cho phép nhân viên không có email
ALTER TABLE employees
    ALTER COLUMN email DROP NOT NULL;

-- Thêm cột quản lý trực tiếp nếu chưa tồn tại
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS quan_ly_truc_tiep VARCHAR(255);

-- Thêm cột quản lý gián tiếp nếu chưa tồn tại
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS quan_ly_gian_tiep VARCHAR(255);

-- Thêm comment mô tả cho hai cột mới
COMMENT ON COLUMN employees.quan_ly_truc_tiep IS 'Tên quản lý trực tiếp phụ trách phê duyệt';
COMMENT ON COLUMN employees.quan_ly_gian_tiep IS 'Tên quản lý gián tiếp/giám đốc chi nhánh nhận thông tin';

COMMIT;


