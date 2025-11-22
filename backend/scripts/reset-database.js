const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'HR_Management_System',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function resetDatabase() {
    const client = await pool.connect();

    try {
        console.log('🔄 Bắt đầu reset database...');
        await client.query('BEGIN');

        // Disable foreign key constraints temporarily by deleting in correct order
        // Delete order: child tables first, then parent tables

        console.log('📝 Đang xóa dữ liệu từ các bảng...');

        // Helper function to safely delete from table
        const safeDelete = async (tableName, displayName) => {
            try {
                // Check if table exists
                const tableCheck = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    );
                `, [tableName]);

                if (tableCheck.rows[0].exists) {
                    console.log(`  - Xóa ${displayName}...`);
                    await client.query(`DELETE FROM ${tableName}`);
                    console.log(`    ✓ Đã xóa ${displayName}`);
                } else {
                    console.log(`  - ${displayName}: bảng không tồn tại, bỏ qua`);
                }
            } catch (e) {
                console.log(`    ⚠ Lỗi khi xóa ${displayName}: ${e.message}`);
                // Continue with other tables
            }
        };

        // Delete in order: child tables first, then parent tables
        await safeDelete('interview_requests', 'interview_requests');
        await safeDelete('candidates', 'candidates');
        await safeDelete('request_items', 'request_items');
        await safeDelete('notifications', 'notifications');
        await safeDelete('leave_requests', 'leave_requests');
        await safeDelete('overtime_requests', 'overtime_requests');
        await safeDelete('attendance_adjustments', 'attendance_adjustments');
        await safeDelete('travel_expense_requests', 'travel_expense_requests');
        await safeDelete('requests', 'requests');
        await safeDelete('equipment_assignments', 'equipment_assignments');

        // Note: We KEEP employees and users tables

        // Reset sequences
        console.log('🔄 Đang reset sequences...');

        // Reset candidate sequences
        try {
            await client.query("SELECT setval('candidates_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence candidates_id_seq không tồn tại)');
        }

        try {
            await client.query("SELECT setval('interview_requests_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence interview_requests_id_seq không tồn tại)');
        }

        // Reset request sequences
        try {
            await client.query("SELECT setval('requests_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence requests_id_seq không tồn tại)');
        }

        try {
            await client.query("SELECT setval('request_items_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence request_items_id_seq không tồn tại)');
        }

        // Reset leave_requests sequence
        try {
            await client.query("SELECT setval('leave_requests_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence leave_requests_id_seq không tồn tại)');
        }

        // Reset overtime_requests sequence
        try {
            await client.query("SELECT setval('overtime_requests_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence overtime_requests_id_seq không tồn tại)');
        }

        // Reset attendance_adjustments sequence
        try {
            await client.query("SELECT setval('attendance_adjustments_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence attendance_adjustments_id_seq không tồn tại)');
        }

        // Reset travel_expense_requests sequence
        try {
            await client.query("SELECT setval('travel_expense_requests_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence travel_expense_requests_id_seq không tồn tại)');
        }

        // Reset equipment_assignments sequence
        try {
            await client.query("SELECT setval('equipment_assignments_id_seq', 1, false)");
        } catch (e) {
            console.log('    (Sequence equipment_assignments_id_seq không tồn tại)');
        }

        await client.query('COMMIT');
        console.log('✅ Reset database thành công!');
        console.log('📌 Lưu ý: Bảng employees và users đã được giữ lại.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi khi reset database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the script
resetDatabase()
    .then(() => {
        console.log('✨ Hoàn tất!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Lỗi:', error);
        process.exit(1);
    });
