-- ============================================
-- Script: Tạo account Hành chính nhân sự (HR)
-- ============================================
-- Tạo tài khoản HR để xử lý các yêu cầu gửi đến phòng HR
-- ============================================

-- Password mặc định: RMG123@ (sẽ được hash bằng bcrypt)
-- Hash của RMG123@ với bcrypt (cost: 10):
-- $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

-- Kiểm tra xem đã có account HR chưa
DO $$
DECLARE
    hr_user_count INTEGER;
    hr_user_id INTEGER;
BEGIN
    -- Kiểm tra xem đã có user HR chưa
    SELECT COUNT(*) INTO hr_user_count
    FROM users
    WHERE role = 'HR' AND trang_thai = 'ACTIVE';
    
    IF hr_user_count = 0 THEN
        -- Tạo account HR mới
        INSERT INTO users (username, password, role, ho_ten, email, trang_thai)
        VALUES (
            'hr_admin',
            '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- RMG123@
            'HR',
            'Hành chính nhân sự',
            'hr@rmg.com',
            'ACTIVE'
        )
        RETURNING id INTO hr_user_id;
        
        RAISE NOTICE '✅ Đã tạo account HR thành công!';
        RAISE NOTICE '   Username: hr_admin';
        RAISE NOTICE '   Password: RMG123@';
        RAISE NOTICE '   Role: HR';
        RAISE NOTICE '   ID: %', hr_user_id;
    ELSE
        RAISE NOTICE '⚠️  Đã có account HR trong hệ thống';
        SELECT id INTO hr_user_id FROM users WHERE role = 'HR' AND trang_thai = 'ACTIVE' LIMIT 1;
        RAISE NOTICE '   Account HR hiện tại: ID = %', hr_user_id;
    END IF;
END $$;

-- Kiểm tra lại các account HR
SELECT 
    id,
    username,
    role,
    ho_ten,
    email,
    trang_thai,
    created_at
FROM users
WHERE role = 'HR'
ORDER BY created_at DESC;

