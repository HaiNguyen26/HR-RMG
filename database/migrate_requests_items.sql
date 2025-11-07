-- ============================================
-- Migration: Chuyển items từ JSONB sang request_items
-- ============================================
-- Script này sẽ migrate dữ liệu items từ cột items (JSONB) 
-- sang bảng request_items cho các requests đã tồn tại
-- ============================================

-- Function để migrate items từ JSONB sang request_items
CREATE OR REPLACE FUNCTION migrate_request_items()
RETURNS void AS $$
DECLARE
    request_record RECORD;
    item_record JSONB;
    item_name TEXT;
    item_quantity INTEGER;
BEGIN
    -- Lặp qua tất cả requests có items nhưng chưa có request_items
    FOR request_record IN 
        SELECT r.id, r.items
        FROM requests r
        WHERE r.items IS NOT NULL 
          AND r.items::text != 'null'
          AND NOT EXISTS (
              SELECT 1 FROM request_items ri WHERE ri.request_id = r.id
          )
    LOOP
        -- Parse items JSONB
        IF jsonb_typeof(request_record.items) = 'array' THEN
            -- Lặp qua từng item trong array
            FOR item_record IN SELECT * FROM jsonb_array_elements(request_record.items)
            LOOP
                -- Lấy item_name
                IF jsonb_typeof(item_record) = 'string' THEN
                    item_name := item_record::text;
                    item_quantity := 1;
                ELSIF jsonb_typeof(item_record) = 'object' THEN
                    -- Lấy item_name từ các trường có thể có
                    item_name := COALESCE(
                        item_record->>'name',
                        item_record->>'tenVatDung',
                        item_record->>'item_name',
                        item_record::text
                    );
                    item_quantity := COALESCE(
                        (item_record->>'quantity')::integer,
                        (item_record->>'soLuong')::integer,
                        1
                    );
                ELSE
                    item_name := item_record::text;
                    item_quantity := 1;
                END IF;
                
                -- Loại bỏ dấu ngoặc kép nếu có
                item_name := TRIM(BOTH '"' FROM item_name);
                
                -- Chỉ insert nếu item_name không rỗng
                IF item_name IS NOT NULL AND item_name != '' AND item_name != 'null' THEN
                    INSERT INTO request_items (request_id, item_name, quantity, status)
                    VALUES (request_record.id, item_name, item_quantity, 'PENDING')
                    ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Chạy migration
SELECT migrate_request_items();

-- Xóa function sau khi chạy xong (optional)
-- DROP FUNCTION IF EXISTS migrate_request_items();

