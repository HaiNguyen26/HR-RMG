-- Migration: Add PENDING status to employees table
-- This allows employees imported from Excel to have PENDING status (chờ cập nhật vật dụng)

-- Drop the existing check constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_trang_thai_check;

-- Add new check constraint with PENDING status
ALTER TABLE employees 
ADD CONSTRAINT employees_trang_thai_check 
CHECK (trang_thai IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'PENDING'));

-- Update the comment for the column
COMMENT ON COLUMN employees.trang_thai IS 'Trạng thái: ACTIVE (hoạt động), INACTIVE (không hoạt động), RESIGNED (đã nghỉ việc), PENDING (chờ cập nhật vật dụng)';

