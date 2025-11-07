-- ============================================
-- Script: Thêm bảng users vào database
-- Chạy script này nếu chưa có bảng users
-- ============================================

-- Bảng: users (Người dùng hệ thống)
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

-- Trigger để tự động update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Kiểm tra xem đã có bảng users chưa
SELECT 
    table_name, 
    (SELECT COUNT(*) FROM users) as total_users
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'users';
