-- ============================================
-- SEED DEPARTMENTS AND POSITIONS
-- ============================================
-- Script này sẽ thêm các phòng ban và vị trí ứng tuyển
-- vào bảng candidates để có thể sử dụng trong dropdown
-- ============================================

BEGIN;

-- Xóa các placeholder candidates cũ (nếu có) để tránh duplicate
DELETE FROM candidates 
WHERE ho_ten LIKE '[Placeholder%' 
   OR notes = 'Được tạo tự động từ yêu cầu tuyển dụng';

-- Danh sách phòng ban cần thêm
-- Từ ảnh 3 và 4: Mua hàng, Hành chính, DVĐT, QA, Khảo sát thiết kế, Tự động, CNC, Dịch vụ kỹ thuật, Kế toán
INSERT INTO candidates (ho_ten, phong_ban, vi_tri_ung_tuyen, status, notes, created_at)
VALUES
    -- Phòng ban: Mua hàng
    ('[Placeholder - Mua hàng]', 'Mua hàng', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: Hành chính
    ('[Placeholder - Hành chính]', 'Hành chính', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: DVĐT
    ('[Placeholder - DVĐT]', 'DVĐT', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: QA
    ('[Placeholder - QA]', 'QA', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: Khảo sát thiết kế
    ('[Placeholder - Khảo sát thiết kế]', 'Khảo sát thiết kế', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: Tự động
    ('[Placeholder - Tự động]', 'Tự động', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: CNC
    ('[Placeholder - CNC]', 'CNC', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: Dịch vụ kỹ thuật
    ('[Placeholder - Dịch vụ kỹ thuật]', 'Dịch vụ kỹ thuật', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW()),
    
    -- Phòng ban: Kế toán
    ('[Placeholder - Kế toán]', 'Kế toán', NULL, 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown phòng ban', NOW())
ON CONFLICT DO NOTHING;

-- Danh sách vị trí ứng tuyển cần thêm
-- Từ ảnh 1 và 2: Mua hàng, Tạp vụ & nấu ăn, Hàn bo mạch, Chất lượng, Khảo sát thiết kế, Admin dự án, Lắp ráp, Lắp ráp JIG, Pallet, Điện lập trình PLC, Thiết kế máy tự động, Vận hành máy CNC, Dịch vụ Kỹ thuật, Kế toán nội bộ, Kế toán bán hàng
INSERT INTO candidates (ho_ten, phong_ban, vi_tri_ung_tuyen, status, notes, created_at)
VALUES
    -- Vị trí: Mua hàng
    ('[Placeholder - Mua hàng]', NULL, 'Mua hàng', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Tạp vụ & nấu ăn
    ('[Placeholder - Tạp vụ & nấu ăn]', NULL, 'Tạp vụ & nấu ăn', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Hàn bo mạch
    ('[Placeholder - Hàn bo mạch]', NULL, 'Hàn bo mạch', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Chất lượng
    ('[Placeholder - Chất lượng]', NULL, 'Chất lượng', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Khảo sát thiết kế
    ('[Placeholder - Khảo sát thiết kế]', NULL, 'Khảo sát thiết kế', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Admin dự án
    ('[Placeholder - Admin dự án]', NULL, 'Admin dự án', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Lắp ráp
    ('[Placeholder - Lắp ráp]', NULL, 'Lắp ráp', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Lắp ráp JIG, Pallet
    ('[Placeholder - Lắp ráp JIG, Pallet]', NULL, 'Lắp ráp JIG, Pallet', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Điện lập trình PLC
    ('[Placeholder - Điện lập trình PLC]', NULL, 'Điện lập trình PLC', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Thiết kế máy tự động
    ('[Placeholder - Thiết kế máy tự động]', NULL, 'Thiết kế máy tự động', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Vận hành máy CNC
    ('[Placeholder - Vận hành máy CNC]', NULL, 'Vận hành máy CNC', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Dịch vụ Kỹ thuật
    ('[Placeholder - Dịch vụ Kỹ thuật]', NULL, 'Dịch vụ Kỹ thuật', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Kế toán nội bộ
    ('[Placeholder - Kế toán nội bộ]', NULL, 'Kế toán nội bộ', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW()),
    
    -- Vị trí: Kế toán bán hàng
    ('[Placeholder - Kế toán bán hàng]', NULL, 'Kế toán bán hàng', 'PENDING_INTERVIEW', 'Dữ liệu mẫu cho dropdown vị trí ứng tuyển', NOW())
ON CONFLICT DO NOTHING;

COMMIT;

-- Hiển thị kết quả
DO $$
DECLARE
    dept_count INTEGER;
    pos_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT phong_ban) INTO dept_count 
    FROM candidates 
    WHERE phong_ban IS NOT NULL AND phong_ban != '';
    
    SELECT COUNT(DISTINCT vi_tri_ung_tuyen) INTO pos_count 
    FROM candidates 
    WHERE vi_tri_ung_tuyen IS NOT NULL AND vi_tri_ung_tuyen != '';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Đã thêm dữ liệu phòng ban và vị trí ứng tuyển!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 Số lượng phòng ban: %', dept_count;
    RAISE NOTICE '📊 Số lượng vị trí ứng tuyển: %', pos_count;
    RAISE NOTICE '========================================';
END $$;

