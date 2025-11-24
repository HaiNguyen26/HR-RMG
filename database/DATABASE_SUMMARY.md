# Tổng hợp Database Schema - HR Management System

## Danh sách các bảng trong hệ thống

### 1. Bảng cơ bản (từ database_schema_postgresql.sql)
- ✅ **employees** - Thông tin nhân viên
- ✅ **users** - Người dùng hệ thống (Admin, IT, HR, Accounting)
- ✅ **equipment_assignments** - Phân công vật dụng cho nhân viên

### 2. Bảng Quản lý Yêu cầu
- ✅ **leave_requests** - Yêu cầu nghỉ phép (migration: `create_leave_requests_table.sql`)
- ✅ **overtime_requests** - Yêu cầu làm thêm giờ (migration: `migrate_overtime_attendance_requests.sql`)
- ✅ **attendance_adjustments** - Điều chỉnh chấm công (migration: `migrate_overtime_attendance_requests.sql`)
- ✅ **travel_expense_requests** - Yêu cầu chi phí công tác (migration: `create_travel_expense_requests_table.sql`)

### 3. Bảng Quản lý Ứng viên
- ✅ **candidates** - Thông tin ứng viên (migration: `migrate_candidates_table_add_fields.sql`)
- ✅ **interview_requests** - Yêu cầu phỏng vấn (migration: `create_interview_requests_table.sql`)
- ✅ **recruitment_requests** - Yêu cầu tuyển dụng từ phòng ban (migration: `create_recruitment_requests_table.sql`)

## Migration Files

### Core Schema
- `database_schema_postgresql.sql` - Schema chính (employees, users, equipment_assignments)

### Leave Requests
- `create_leave_requests_table.sql` - Tạo bảng leave_requests

### Overtime & Attendance
- `migrate_overtime_attendance_requests.sql` - Tạo bảng overtime_requests và attendance_adjustments

### Travel Expenses
- `create_travel_expense_requests_table.sql` - Tạo bảng travel_expense_requests

### Candidates
- `migrate_candidates_table_add_fields.sql` - Thêm các trường mới vào bảng candidates (thông tin cá nhân, kinh nghiệm, đào tạo, ngoại ngữ)

### Interview & Recruitment
- `create_interview_requests_table.sql` - Tạo bảng interview_requests
- `create_recruitment_requests_table.sql` - Tạo bảng recruitment_requests

### Other Migrations
- `database_add_users_table.sql` - Thêm bảng users
- `database_add_employee_code.sql` - Thêm mã nhân viên
- `add_branch_to_employees.sql` - Thêm chi nhánh
- `add_manager_role_to_users.sql` - Thêm vai trò manager
- `add_pending_status_to_employees.sql` - Thêm trạng thái PENDING
- `allow_null_employee_optional_fields.sql` - Cho phép NULL các trường tùy chọn
- `migrate_leave_requests_workflow.sql` - Cập nhật workflow cho leave_requests
- `migrate_update_employees_manager_fields.sql` - Cập nhật trường manager
- `migrate_requests_items.sql` - Migration cho request items
- `database_requests_notifications.sql` - Notifications cho requests
- `migrate_notifications_add_employee_id.sql` - Thêm employee_id vào notifications
- `migrate_update_request_notifications_include_admin.sql` - Cập nhật notifications
- `database_update_request_items_tracking.sql` - Tracking cho request items
- `update_request_status_logic.sql` - Cập nhật logic trạng thái
- `cleanup_orphaned_requests.sql` - Dọn dẹp requests orphaned
- `create_hr_account.sql` - Tạo tài khoản HR

## Trạng thái Mock Data

### ✅ Đã xóa toàn bộ Mock Data
- ✅ `frontend/src/components/CandidateManagement/CandidateManagement.js` - Đã xóa MOCK_CANDIDATES và useMockData
- ✅ `frontend/src/components/TravelExpense/TravelExpenseManagement.js` - Đã thay mock data bằng `travelExpensesAPI.getAll()`
- ✅ `frontend/src/components/TravelExpenseApproval/TravelExpenseApproval.js` - Đã thay mock data bằng `travelExpensesAPI.getAll()` và `travelExpensesAPI.decide()`

**Kết luận:** Toàn bộ dự án đã không còn sử dụng mock data, tất cả đều kết nối với database thông qua API.

## Ghi chú

1. Tất cả các bảng đều được tạo tự động trong code backend thông qua các hàm `ensureTable()` hoặc `ensureXXXTable()`.
2. Các file migration SQL được tạo để backup và documentation, có thể chạy độc lập nếu cần.
3. Hệ thống không còn sử dụng mock data (trừ TravelExpenseManagement - đang cần cập nhật).

