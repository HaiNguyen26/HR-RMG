DO $$
BEGIN
    -- Thêm cột chi_nhanh vào bảng employees nếu chưa tồn tại
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'employees'
          AND column_name = 'chi_nhanh'
    ) THEN
        ALTER TABLE employees
            ADD COLUMN chi_nhanh VARCHAR(255);

        COMMENT ON COLUMN employees.chi_nhanh IS 'Chi nhánh làm việc của nhân viên';
    END IF;
END $$;

