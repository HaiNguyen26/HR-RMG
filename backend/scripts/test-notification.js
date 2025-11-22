const pool = require('../config/database');

async function testNotification() {
    try {
        console.log('='.repeat(60));
        console.log('KIỂM TRA THÔNG BÁO SAU KHI TỪ CHỐI ĐƠN PHỎNG VẤN');
        console.log('='.repeat(60));

        // Kiểm tra notifications gần đây về từ chối đơn phỏng vấn
        const recentRejections = await pool.query(`
            SELECT 
                n.id,
                n.user_id,
                u.username,
                u.role,
                n.title,
                n.message,
                n.is_read,
                n.created_at,
                n.candidate_id,
                c.ho_ten as candidate_name,
                c.vi_tri_ung_tuyen as candidate_position
            FROM notifications n
            INNER JOIN users u ON n.user_id = u.id
            LEFT JOIN candidates c ON n.candidate_id = c.id
            WHERE n.title LIKE '%từ chối%' OR n.title LIKE '%Từ chối%'
            ORDER BY n.created_at DESC
            LIMIT 10
        `);

        console.log('\n1. THÔNG BÁO TỪ CHỐI GẦN ĐÂY:');
        console.log('-'.repeat(60));
        
        if (recentRejections.rows.length === 0) {
            console.log('❌ Không có thông báo từ chối nào');
        } else {
            console.log(`✅ Tìm thấy ${recentRejections.rows.length} thông báo từ chối:\n`);
            recentRejections.rows.forEach((notif, idx) => {
                const isInterviewRejection = notif.title.includes('ứng viên') || notif.title.includes('Ứng viên');
                const type = isInterviewRejection ? '🎯 PHỎNG VẤN' : '📋 ĐƠN NGHỈ';
                console.log(`${idx + 1}. [${type}] User: ${notif.username} (ID: ${notif.user_id})`);
                console.log(`   Notification ID: ${notif.id}`);
                console.log(`   Title: ${notif.title}`);
                console.log(`   Message: ${notif.message}`);
                if (notif.candidate_name) {
                    console.log(`   Candidate: ${notif.candidate_name} (${notif.candidate_position}) - ID: ${notif.candidate_id}`);
                }
                console.log(`   Read: ${notif.is_read ? '✅' : '🔴'}`);
                console.log(`   Created: ${notif.created_at}`);
                console.log('');
            });
        }

        // Kiểm tra interview requests gần đây
        console.log('\n2. CÁC YÊU CẦU PHỎNG VẤN GẦN ĐÂY:');
        console.log('-'.repeat(60));
        const recentInterviews = await pool.query(`
            SELECT 
                ir.id,
                ir.candidate_id,
                c.ho_ten as candidate_name,
                c.vi_tri_ung_tuyen as candidate_position,
                ir.manager_id,
                e.ho_ten as manager_name,
                ir.status,
                ir.created_at,
                ir.updated_at
            FROM interview_requests ir
            LEFT JOIN candidates c ON ir.candidate_id = c.id
            LEFT JOIN employees e ON ir.manager_id = e.id
            ORDER BY ir.updated_at DESC
            LIMIT 10
        `);

        if (recentInterviews.rows.length === 0) {
            console.log('❌ Không có yêu cầu phỏng vấn nào');
        } else {
            console.log(`✅ Tìm thấy ${recentInterviews.rows.length} yêu cầu phỏng vấn:\n`);
            recentInterviews.rows.forEach((interview, idx) => {
                const statusEmoji = interview.status === 'REJECTED' ? '❌' : 
                                   interview.status === 'APPROVED' ? '✅' : '⏳';
                console.log(`${idx + 1}. ${statusEmoji} Status: ${interview.status}`);
                console.log(`   Candidate: ${interview.candidate_name || 'N/A'} (${interview.candidate_position || 'N/A'})`);
                console.log(`   Manager: ${interview.manager_name || 'N/A'} (ID: ${interview.manager_id})`);
                console.log(`   Interview Request ID: ${interview.id}`);
                console.log(`   Updated: ${interview.updated_at}`);
                console.log('');
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('HƯỚNG DẪN KIỂM TRA:');
        console.log('='.repeat(60));
        console.log('1. Đăng nhập với tài khoản HR (hr hoặc hr_admin)');
        console.log('2. Mở Developer Tools (F12) -> Console tab');
        console.log('3. Kiểm tra currentUser: console.log("Current User:", localStorage.getItem("user"))');
        console.log('4. Kiểm tra userId của HR user đang đăng nhập');
        console.log('5. Từ chối một đơn phỏng vấn và kiểm tra notification');
        console.log('6. Chạy lại script này để xem notification mới');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Lỗi:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
    }
}

testNotification();


