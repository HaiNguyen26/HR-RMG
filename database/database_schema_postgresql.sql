-- ============================================
-- HR Management System - PostgreSQL Database Schema
-- ============================================
-- Database: HR_Management_System
-- Created: 2024
-- ============================================

-- Tạo database (chạy riêng với user postgres)
-- CREATE DATABASE HR_Management_System
-- WITH ENCODING = 'UTF8'
-- LC_COLLATE = 'en_US.UTF-8'
-- LC_CTYPE = 'en_US.UTF-8';

-- \c HR_Management_System;

-- ============================================
-- Extension cho UUID (nếu muốn dùng UUID thay vì INT)
-- ============================================
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Bảng: employees (Nhân viên)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    ho_ten VARCHAR(255) NOT NULL,
    chuc_danh VARCHAR(255) NOT NULL,
    phong_ban VARCHAR(20) NOT NULL CHECK (phong_ban IN ('IT', 'HR', 'ACCOUNTING', 'OTHER')),
    bo_phan VARCHAR(255) NOT NULL,
    chi_nhanh VARCHAR(255) NULL,
    ngay_gia_nhap DATE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    trang_thai VARCHAR(20) DEFAULT 'ACTIVE' CHECK (trang_thai IN ('ACTIVE', 'INACTIVE', 'RESIGNED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_phong_ban ON employees(phong_ban);
CREATE INDEX IF NOT EXISTS idx_employees_trang_thai ON employees(trang_thai);

-- Comments
COMMENT ON TABLE employees IS 'Bảng lưu thông tin nhân viên';
COMMENT ON COLUMN employees.password IS 'Mật khẩu được hash bcrypt (mặc định: RMG123@)';
COMMENT ON COLUMN employees.chi_nhanh IS 'Chi nhánh làm việc của nhân viên';

-- ============================================
-- Bảng: users (Người dùng hệ thống)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'IT', 'HR', 'ACCOUNTING')),
    ho_ten VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    trang_thai VARCHAR(20) DEFAULT 'ACTIVE' CHECK (trang_thai IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_trang_thai ON users(trang_thai);

-- Comments
COMMENT ON TABLE users IS 'Bảng lưu thông tin người dùng hệ thống (Admin, IT, HR, Kế toán)';
COMMENT ON COLUMN users.password IS 'Mật khẩu được hash bcrypt (mặc định: RMG123@)';
COMMENT ON COLUMN users.role IS 'Vai trò: ADMIN (toàn quyền), IT, HR (thêm/sửa/xóa nhân viên), ACCOUNTING';

-- ============================================
-- Bảng: equipment_assignments (Phân công vật dụng)
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    phong_ban VARCHAR(20) NOT NULL CHECK (phong_ban IN ('IT', 'HR', 'ACCOUNTING', 'OTHER')),
    ten_vat_dung VARCHAR(255) NOT NULL,
    so_luong INTEGER DEFAULT 1,
    trang_thai VARCHAR(20) DEFAULT 'PENDING' CHECK (trang_thai IN ('PENDING', 'ASSIGNED', 'RETURNED')),
    ngay_phan_cong DATE DEFAULT CURRENT_DATE,
    ngay_tra DATE NULL,
    ghi_chu TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_equipment_employee_id ON equipment_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_equipment_phong_ban ON equipment_assignments(phong_ban);
CREATE INDEX IF NOT EXISTS idx_equipment_trang_thai ON equipment_assignments(trang_thai);

-- Comments
COMMENT ON TABLE equipment_assignments IS 'Bảng lưu thông tin phân công vật dụng cho nhân viên';

-- ============================================
-- Function: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers để tự động update updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger để tự động update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views: Một số view hữu ích
-- ============================================
-- View: Danh sách nhân viên với tổng số vật dụng được phân công
CREATE OR REPLACE VIEW v_employees_with_equipment_count AS
SELECT 
    e.id,
    e.ho_ten,
    e.chuc_danh,
    e.phong_ban,
    e.bo_phan,
    e.ngay_gia_nhap,
    e.email,
    e.trang_thai,
    COUNT(eq.id) as tong_vat_dung,
    e.created_at,
    e.updated_at
FROM employees e
LEFT JOIN equipment_assignments eq ON e.id = eq.employee_id AND eq.trang_thai != 'RETURNED'
GROUP BY e.id;

-- View: Tỷ lệ nhân viên theo phòng ban
CREATE OR REPLACE VIEW v_employee_ratio_by_department AS
SELECT 
    phong_ban,
    COUNT(*)::INTEGER as so_luong,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM employees WHERE trang_thai = 'ACTIVE'), 0), 2)::DECIMAL(5,2) as ty_le_phan_tram
FROM employees
WHERE trang_thai = 'ACTIVE'
GROUP BY phong_ban;

-- ============================================
-- Notes:
-- ============================================
-- 1. Password mặc định "RMG123@" cần được hash bằng bcrypt trong application code
-- 
-- 2. Database sử dụng UTF8 encoding để hỗ trợ đầy đủ tiếng Việt
-- 
-- 3. Foreign key constraints đảm bảo tính toàn vẹn dữ liệu (ON DELETE CASCADE)
-- 
-- 4. Indexes được tạo để tối ưu hiệu suất query
-- 
-- 5. Triggers tự động cập nhật updated_at khi có thay đổi
-- 
-- 6. CHECK constraints đảm bảo dữ liệu hợp lệ cho ENUM fields
