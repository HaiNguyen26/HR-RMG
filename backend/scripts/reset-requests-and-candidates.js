const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

async function resetRequestsAndCandidates() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 Đang xóa dữ liệu...\n');
        
        // Danh sách các bảng cần xóa (theo thứ tự để tránh lỗi foreign key)
        const tables = [
            { name: 'interview_requests', description: 'Yêu cầu phỏng vấn' },
            { name: 'attendance_adjustments', description: 'Đơn bổ sung chấm công' },
            { name: 'overtime_requests', description: 'Đơn tăng ca' },
            { name: 'leave_requests', description: 'Đơn nghỉ phép' },
            { name: 'request_items', description: 'Chi tiết yêu cầu thiết bị' },
            { name: 'requests', description: 'Yêu cầu thiết bị' },
            { name: 'candidates', description: 'Ứng viên' }
        ];
        
        let totalDeleted = 0;
        
        for (const table of tables) {
            try {
                // Kiểm tra xem bảng có tồn tại không
                const tableExists = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [table.name]);
                
                if (!tableExists.rows[0].exists) {
                    console.log(`⚠️  Bảng "${table.name}" không tồn tại, bỏ qua...`);
                    continue;
                }
                
                // Đếm số bản ghi trước khi xóa
                const countResult = await client.query(`SELECT COUNT(*) FROM ${table.name}`);
                const count = parseInt(countResult.rows[0].count);
                
                if (count === 0) {
                    console.log(`✓ ${table.description}: Không có dữ liệu`);
                    continue;
                }
                
                // Xóa dữ liệu
                await client.query(`DELETE FROM ${table.name}`);
                
                // Reset sequence nếu có
                try {
                    await client.query(`ALTER SEQUENCE ${table.name}_id_seq RESTART WITH 1`);
                } catch (err) {
                    // Sequence có thể không tồn tại, không sao
                }
                
                totalDeleted += count;
                console.log(`✓ ${table.description}: Đã xóa ${count} bản ghi`);
                
            } catch (error) {
                console.error(`✗ Lỗi khi xóa bảng "${table.name}":`, error.message);
                throw error;
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ Hoàn tất!');
        console.log(`📊 Tổng cộng đã xóa: ${totalDeleted} bản ghi\n`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Lỗi:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

resetRequestsAndCandidates()
    .then(() => {
        console.log('Đã đóng kết nối database.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Lỗi thực thi:', error);
        process.exit(1);
    });


