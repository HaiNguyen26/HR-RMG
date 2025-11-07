// Load environment variables
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'HR_Management_System',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Hainguyen261097',
});

const createUsersTableSQL = `
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
`;

async function createUsersTable() {
  try {
    console.log('Đang kết nối database...');
    console.log('Đang tạo bảng users...\n');

    // Kiểm tra xem function update_updated_at_column đã tồn tại chưa
    const checkFunctionSQL = `
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
      );
    `;
    const functionExists = await pool.query(checkFunctionSQL);
    
    if (!functionExists.rows[0].exists) {
      console.log('Đang tạo function update_updated_at_column...');
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      console.log('✅ Đã tạo function update_updated_at_column\n');
    }

    // Tạo bảng users
    await pool.query(createUsersTableSQL);
    console.log('✅ Đã tạo bảng users thành công!');

    // Tạo trigger
    const createTriggerSQL = `
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;
    await pool.query(createTriggerSQL);
    console.log('✅ Đã tạo trigger update_users_updated_at\n');

    // Kiểm tra bảng đã được tạo
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users';
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('✅ Bảng users đã sẵn sàng!\n');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Chạy script
createUsersTable();
