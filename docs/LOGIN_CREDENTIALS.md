# Thông tin đăng nhập hệ thống HR Management

## Tài khoản mặc định

Tất cả các tài khoản đều có **password mặc định: `RMG123@`**

### 1. Admin (Quản trị viên)
- **Username:** `admin`
- **Password:** `RMG123@`
- **Role:** ADMIN
- **Quyền:** Toàn quyền hệ thống
- **Email:** admin@rmg.com

### 2. IT (Nhân viên IT)
- **Username:** `it`
- **Password:** `RMG123@`
- **Role:** IT
- **Quyền:** Quản lý thiết bị IT
- **Email:** it@rmg.com

### 3. HR (Nhân viên HR) - Tạo nhân viên
- **Username:** `hr`
- **Password:** `RMG123@`
- **Role:** HR
- **Quyền:** Thêm/sửa/xóa nhân viên (Full CRUD), Theo dõi yêu cầu
- **Email:** hr@rmg.com

### 3b. HR Admin (Hành chính nhân sự) - Xử lý yêu cầu
- **Username:** `hr_admin`
- **Password:** `RMG123@`
- **Role:** HR
- **Quyền:** Xử lý các yêu cầu gửi đến phòng Hành chính nhân sự (Vật dụng văn phòng)
- **Email:** hr@rmg.com

### 4. Kế toán (Accounting)
- **Username:** `ketoan`
- **Password:** `RMG123@`
- **Role:** ACCOUNTING
- **Quyền:** Quản lý kế toán
- **Email:** ketoan@rmg.com

---

## Lưu ý

- Tất cả tài khoản đều có trạng thái: **ACTIVE**
- Password đã được hash bằng bcrypt trong database
- Vui lòng đổi password sau lần đăng nhập đầu tiên (tính năng này sẽ được thêm sau)

