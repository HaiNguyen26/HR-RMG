// Load environment variables
require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'HR_Management_System',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Hainguyen261097',
});

const defaultPassword = 'RMG123@';
const saltRounds = 10;

const users = [
  {
    username: 'admin',
    role: 'ADMIN',
    ho_ten: 'Quản trị viên',
    email: 'admin@rmg.com',
    description: 'Toàn quyền hệ thống'
  },
  {
    username: 'it',
    role: 'IT',
    ho_ten: 'Nhân viên IT',
    email: 'it@rmg.com',
    description: 'Quản lý thiết bị IT'
  },
  {
    username: 'hr',
    role: 'HR',
    ho_ten: 'Nhân viên HR',
    email: 'hr@rmg.com',
    description: 'Quyền thêm/sửa/xóa nhân viên'
  },
  {
    username: 'ketoan',
    role: 'ACCOUNTING',
    ho_ten: 'Nhân viên Kế toán',
    email: 'ketoan@rmg.com',
    description: 'Quản lý kế toán'
  }
];

async function createUsers() {
  try {
    console.log('Đang kết nối database...');
    
    // Hash password một lần cho tất cả users
    console.log(`Đang hash password: ${defaultPassword}`);
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
    console.log('Hash password thành công!\n');

    // Tạo từng user
    for (const user of users) {
      try {
        // Kiểm tra xem user đã tồn tại chưa
        const checkQuery = 'SELECT id FROM users WHERE username = $1';
        const checkResult = await pool.query(checkQuery, [user.username]);

        if (checkResult.rows.length > 0) {
          console.log(`⚠️  User "${user.username}" đã tồn tại, bỏ qua...`);
          continue;
        }

        // Insert user mới
        const insertQuery = `
          INSERT INTO users (username, password, role, ho_ten, email, trang_thai)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, username, role
        `;
        
        const result = await pool.query(insertQuery, [
          user.username,
          hashedPassword,
          user.role,
          user.ho_ten,
          user.email,
          'ACTIVE'
        ]);

        console.log(`✅ Đã tạo user: ${user.username} (${user.role})`);
        console.log(`   - Mô tả: ${user.description}`);
        console.log(`   - Password: ${defaultPassword}`);
        console.log(`   - ID: ${result.rows[0].id}\n`);
      } catch (error) {
        console.error(`❌ Lỗi khi tạo user "${user.username}":`, error.message);
      }
    }

    console.log('\n📋 Tóm tắt các user đã tạo:');
    const allUsers = await pool.query('SELECT id, username, role, ho_ten, email, trang_thai FROM users ORDER BY id');
    allUsers.rows.forEach(user => {
      console.log(`   ${user.id}. ${user.username} (${user.role}) - ${user.ho_ten}`);
    });

    console.log(`\n✅ Hoàn thành! Tất cả users đã được tạo với password: ${defaultPassword}`);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Chạy script
createUsers();
