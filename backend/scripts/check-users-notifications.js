const pool = require('../config/database');

async function checkUsersAndNotifications() {
    try {
        console.log('='.repeat(60));
        console.log('KIỂM TRA USERS VÀ NOTIFICATIONS');
        console.log('='.repeat(60));

        // 1. Kiểm tra tất cả users HR
        console.log('\n1. DANH SÁCH USERS HR:');
        console.log('-'.repeat(60));
        const hrUsers = await pool.query(`
            SELECT id, username, ho_ten, email, role, trang_thai, created_at
            FROM users
            WHERE UPPER(role) = 'HR'
            ORDER BY id
        `);

        if (hrUsers.rows.length === 0) {
            console.log('❌ Không tìm thấy user HR nào!');
        } else {
            console.log(`✅ Tìm thấy ${hrUsers.rows.length} user(s) HR:\n`);
            hrUsers.rows.forEach((user, index) => {
                console.log(`${index + 1}. ID: ${user.id}`);
                console.log(`   Username: ${user.username}`);
                console.log(`   Họ tên: ${user.ho_ten || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Trạng thái: ${user.trang_thai || 'NULL (Active)'}`);
                console.log(`   Created: ${user.created_at}`);
                console.log('');
            });
        }

        // 2. Kiểm tra notifications cho HR users
        console.log('\n2. THÔNG BÁO CHO HR USERS:');
        console.log('-'.repeat(60));

        for (const hrUser of hrUsers.rows) {
            const notifications = await pool.query(`
                SELECT 
                    n.id,
                    n.title,
                    n.message,
                    n.is_read,
                    n.created_at,
                    n.candidate_id,
                    c.ho_ten as candidate_name
                FROM notifications n
                LEFT JOIN candidates c ON n.candidate_id = c.id
                WHERE n.user_id = $1
                ORDER BY n.created_at DESC
                LIMIT 10
            `, [hrUser.id]);

            console.log(`\nUser HR ID ${hrUser.id} (${hrUser.username}):`);
            if (notifications.rows.length === 0) {
                console.log('   ❌ Không có thông báo nào');
            } else {
                console.log(`   ✅ Có ${notifications.rows.length} thông báo (hiển thị 10 mới nhất):`);
                notifications.rows.forEach((notif, idx) => {
                    const readStatus = notif.is_read ? '✅ Đã đọc' : '🔴 Chưa đọc';
                    console.log(`\n   ${idx + 1}. [${readStatus}] ID: ${notif.id}`);
                    console.log(`      Title: ${notif.title}`);
                    console.log(`      Message: ${notif.message}`);
                    console.log(`      Candidate: ${notif.candidate_name || 'N/A'} (ID: ${notif.candidate_id || 'N/A'})`);
                    console.log(`      Created: ${notif.created_at}`);
                });
            }
        }

        // 3. Kiểm tra notifications chưa đọc
        console.log('\n\n3. THÔNG BÁO CHƯA ĐỌC (UNREAD) CHO HR:');
        console.log('-'.repeat(60));

        const unreadNotifications = await pool.query(`
            SELECT 
                n.id,
                n.user_id,
                u.username,
                n.title,
                n.message,
                n.is_read,
                n.created_at,
                n.candidate_id,
                c.ho_ten as candidate_name
            FROM notifications n
            INNER JOIN users u ON n.user_id = u.id
            LEFT JOIN candidates c ON n.candidate_id = c.id
            WHERE u.role = 'HR' 
                AND n.is_read = FALSE
                AND (u.trang_thai = 'ACTIVE' OR u.trang_thai IS NULL)
            ORDER BY n.created_at DESC
        `);

        if (unreadNotifications.rows.length === 0) {
            console.log('❌ Không có thông báo chưa đọc nào cho HR users');
        } else {
            console.log(`✅ Tìm thấy ${unreadNotifications.rows.length} thông báo chưa đọc:\n`);
            unreadNotifications.rows.forEach((notif, idx) => {
                console.log(`${idx + 1}. User: ${notif.username} (ID: ${notif.user_id})`);
                console.log(`   Notification ID: ${notif.id}`);
                console.log(`   Title: ${notif.title}`);
                console.log(`   Message: ${notif.message}`);
                console.log(`   Candidate: ${notif.candidate_name || 'N/A'} (ID: ${notif.candidate_id || 'N/A'})`);
                console.log(`   Created: ${notif.created_at}`);
                console.log('');
            });
        }

        // 4. Kiểm tra tất cả users (không chỉ HR)
        console.log('\n\n4. TẤT CẢ USERS TRONG HỆ THỐNG:');
        console.log('-'.repeat(60));
        const allUsers = await pool.query(`
            SELECT id, username, ho_ten, email, role, trang_thai
            FROM users
            ORDER BY role, id
        `);

        if (allUsers.rows.length === 0) {
            console.log('❌ Không có user nào trong hệ thống!');
        } else {
            console.log(`✅ Tổng cộng ${allUsers.rows.length} user(s):\n`);
            const usersByRole = {};
            allUsers.rows.forEach(user => {
                if (!usersByRole[user.role]) {
                    usersByRole[user.role] = [];
                }
                usersByRole[user.role].push(user);
            });

            Object.keys(usersByRole).forEach(role => {
                console.log(`\n${role}:`);
                usersByRole[role].forEach((user, idx) => {
                    console.log(`  ${idx + 1}. ID: ${user.id} | ${user.username} | ${user.ho_ten || 'N/A'} | Trạng thái: ${user.trang_thai || 'NULL'}`);
                });
            });
        }

        // 5. Kiểm tra candidates gần đây
        console.log('\n\n5. CÁC ỨNG VIÊN GẦN ĐÂY (để kiểm tra):');
        console.log('-'.repeat(60));
        const recentCandidates = await pool.query(`
            SELECT id, ho_ten, vi_tri_ung_tuyen, phong_ban, status, created_at
            FROM candidates
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (recentCandidates.rows.length === 0) {
            console.log('❌ Không có ứng viên nào');
        } else {
            console.log(`✅ Có ${recentCandidates.rows.length} ứng viên gần đây:\n`);
            recentCandidates.rows.forEach((candidate, idx) => {
                console.log(`${idx + 1}. ID: ${candidate.id}`);
                console.log(`   Tên: ${candidate.ho_ten}`);
                console.log(`   Vị trí: ${candidate.vi_tri_ung_tuyen}`);
                console.log(`   Phòng ban: ${candidate.phong_ban}`);
                console.log(`   Trạng thái: ${candidate.status}`);
                console.log(`   Created: ${candidate.created_at}`);
                console.log('');
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('KẾT THÚC KIỂM TRA');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
    }
}

checkUsersAndNotifications();


