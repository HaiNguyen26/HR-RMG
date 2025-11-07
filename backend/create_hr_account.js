const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'HR_Management_System',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Hainguyen261097'
});

async function createHRAccount() {
    try {
        // Hash password
        const password = 'RMG123@';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Kiểm tra xem đã có account HR chưa
        const checkResult = await pool.query(
            "SELECT id, username, ho_ten, email FROM users WHERE role = 'HR' AND trang_thai = 'ACTIVE'"
        );
        
        if (checkResult.rows.length > 0) {
            console.log('⚠️  Đã có account HR trong hệ thống:');
            checkResult.rows.forEach(row => {
                console.log(`   ID: ${row.id} | Username: ${row.username} | Tên: ${row.ho_ten} | Email: ${row.email}`);
            });
            
            // Kiểm tra xem có account với username 'hr_admin' chưa
            const hrAdminCheck = await pool.query(
                "SELECT id, username, ho_ten, email FROM users WHERE username = 'hr_admin'"
            );
            
            if (hrAdminCheck.rows.length === 0) {
                // Tạo account hr_admin mới
                const insertResult = await pool.query(
                    `INSERT INTO users (username, password, role, ho_ten, email, trang_thai)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, username, role, ho_ten, email`,
                    ['hr_admin', hashedPassword, 'HR', 'Hành chính nhân sự', 'hr@rmg.com', 'ACTIVE']
                );
                
                console.log('\n✅ Đã tạo account HR mới (hr_admin):');
                const newUser = insertResult.rows[0];
                console.log(`   ID: ${newUser.id}`);
                console.log(`   Username: ${newUser.username}`);
                console.log(`   Password: RMG123@`);
                console.log(`   Role: ${newUser.role}`);
                console.log(`   Tên: ${newUser.ho_ten}`);
                console.log(`   Email: ${newUser.email}`);
            } else {
                console.log('\n⚠️  Username "hr_admin" đã tồn tại');
            }
        } else {
            // Tạo account HR mới
            const insertResult = await pool.query(
                `INSERT INTO users (username, password, role, ho_ten, email, trang_thai)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, username, role, ho_ten, email`,
                ['hr_admin', hashedPassword, 'HR', 'Hành chính nhân sự', 'hr@rmg.com', 'ACTIVE']
            );
            
            console.log('✅ Đã tạo account HR thành công!');
            const newUser = insertResult.rows[0];
            console.log(`   ID: ${newUser.id}`);
            console.log(`   Username: ${newUser.username}`);
            console.log(`   Password: RMG123@`);
            console.log(`   Role: ${newUser.role}`);
            console.log(`   Tên: ${newUser.ho_ten}`);
            console.log(`   Email: ${newUser.email}`);
        }
        
        // Hiển thị tất cả account HR
        console.log('\n📋 Danh sách tất cả account HR:');
        const allHR = await pool.query(
            "SELECT id, username, role, ho_ten, email, trang_thai FROM users WHERE role = 'HR' ORDER BY created_at DESC"
        );
        allHR.rows.forEach(row => {
            console.log(`   ID: ${row.id} | Username: ${row.username} | Tên: ${row.ho_ten} | Email: ${row.email} | Status: ${row.trang_thai}`);
        });
        
        pool.end();
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        pool.end();
    }
}

createHRAccount();

