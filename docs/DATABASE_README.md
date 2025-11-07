# Database Schema - HR Management System

## Tổng quan

Database được thiết kế để lưu trữ thông tin nhân viên và phân công vật dụng trong hệ thống quản lý nhân sự.

## Cấu trúc Database

### Database Name
`HR_Management_System`

### Character Set
- **UTF8MB4** - Hỗ trợ đầy đủ tiếng Việt và emoji

---

## Các Bảng

### 1. Bảng `employees` (Nhân viên)

Lưu trữ thông tin cơ bản của nhân viên.

#### Các trường:

| Tên trường | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----------|-------------|-------|---------|
| `id` | INT | ID tự động tăng | PRIMARY KEY |
| `ho_ten` | VARCHAR(255) | Họ và tên nhân viên | NOT NULL |
| `chuc_danh` | VARCHAR(255) | Chức danh | NOT NULL |
| `phong_ban` | ENUM | Phòng ban | 'IT', 'HR', 'ACCOUNTING', 'OTHER' |
| `bo_phan` | VARCHAR(255) | Bộ phận | NOT NULL |
| `ngay_gia_nhap` | DATE | Ngày gia nhập công ty | NOT NULL |
| `email` | VARCHAR(255) | Email nhân viên | UNIQUE, NOT NULL |
| `password` | VARCHAR(255) | Mật khẩu (bcrypt hash) | Default: RMG123@ (đã hash) |
| `trang_thai` | ENUM | Trạng thái | 'ACTIVE', 'INACTIVE', 'RESIGNED' (Default: ACTIVE) |
| `created_at` | TIMESTAMP | Thời gian tạo | Auto |
| `updated_at` | TIMESTAMP | Thời gian cập nhật | Auto update |

#### Indexes:
- `idx_email` - Tối ưu tìm kiếm theo email
- `idx_phong_ban` - Tối ưu tìm kiếm theo phòng ban
- `idx_trang_thai` - Tối ưu filter theo trạng thái

---

### 2. Bảng `equipment_assignments` (Phân công vật dụng)

Lưu trữ thông tin vật dụng/thiết bị được phân công cho nhân viên.

#### Các trường:

| Tên trường | Kiểu dữ liệu | Mô tả | Ghi chú |
|-----------|-------------|-------|---------|
| `id` | INT | ID tự động tăng | PRIMARY KEY |
| `employee_id` | INT | ID nhân viên | FOREIGN KEY → employees(id) |
| `phong_ban` | ENUM | Phòng ban phân công | 'IT', 'HR', 'ACCOUNTING', 'OTHER' |
| `ten_vat_dung` | VARCHAR(255) | Tên vật dụng/thiết bị | NOT NULL |
| `so_luong` | INT | Số lượng | Default: 1 |
| `trang_thai` | ENUM | Trạng thái phân công | 'PENDING', 'ASSIGNED', 'RETURNED' (Default: PENDING) |
| `ngay_phan_cong` | DATE | Ngày phân công | Default: CURRENT_DATE |
| `ngay_tra` | DATE | Ngày trả lại | NULL (chỉ có khi đã trả) |
| `ghi_chu` | TEXT | Ghi chú | NULL |
| `created_at` | TIMESTAMP | Thời gian tạo | Auto |
| `updated_at` | TIMESTAMP | Thời gian cập nhật | Auto update |

#### Foreign Keys:
- `employee_id` → `employees(id)` ON DELETE CASCADE

#### Indexes:
- `idx_employee_id` - Tối ưu tìm kiếm theo nhân viên
- `idx_phong_ban` - Tối ưu filter theo phòng ban
- `idx_trang_thai` - Tối ưu filter theo trạng thái

---

## Views (Khung nhìn)

### 1. `v_employees_with_equipment_count`

Hiển thị danh sách nhân viên kèm tổng số vật dụng đã được phân công (chưa trả).

**Sử dụng:**
```sql
SELECT * FROM v_employees_with_equipment_count;
```

---

### 2. `v_employee_ratio_by_department`

Hiển thị tỷ lệ nhân viên theo từng phòng ban (chỉ tính nhân viên ACTIVE).

**Sử dụng:**
```sql
SELECT * FROM v_employee_ratio_by_department;
```

**Kết quả mẫu:**
```
phong_ban  | so_luong | ty_le_phan_tram
-----------|----------|----------------
IT         | 56       | 45.00
HR         | 31       | 25.00
ACCOUNTING | 25       | 20.00
OTHER      | 13       | 10.00
```

---

## Stored Procedures

### 1. `sp_create_employee`

Tạo nhân viên mới với password mặc định đã được hash.

**Tham số:**
- `p_ho_ten` - Họ và tên
- `p_chuc_danh` - Chức danh
- `p_phong_ban` - Phòng ban
- `p_bo_phan` - Bộ phận
- `p_ngay_gia_nhap` - Ngày gia nhập
- `p_email` - Email
- `p_employee_id` (OUT) - ID nhân viên vừa tạo

**Sử dụng:**
```sql
CALL sp_create_employee(
    'Nguyễn Văn A',
    'Nhân viên IT',
    'IT',
    'Phát triển phần mềm',
    '2024-01-15',
    'nguyenvana@rmg.com',
    @employee_id
);

SELECT @employee_id;
```

---

## Password Mặc định

- **Password mặc định:** `RMG123@`
- **Hashing:** Bcrypt (cost: 10)
- **Lưu ý:** 
  - Password nên được hash trong application code (backend)
  - Hash mẫu trong database chỉ là placeholder
  - Mỗi lần tạo nhân viên mới, cần hash password mới để đảm bảo an toàn

**Ví dụ hash trong PHP:**
```php
$password = 'RMG123@';
$hashed = password_hash($password, PASSWORD_BCRYPT);
```

**Ví dụ hash trong Node.js:**
```javascript
const bcrypt = require('bcrypt');
const password = 'RMG123@';
const hashed = await bcrypt.hash(password, 10);
```

---

## Cách sử dụng

### 1. Import Database Schema

```bash
mysql -u root -p < database_schema.sql
```

Hoặc sử dụng MySQL Workbench, phpMyAdmin, hoặc bất kỳ công cụ quản lý database nào.

### 2. Kết nối Database

**Thông tin kết nối:**
- Database: `HR_Management_System`
- Host: `localhost` (hoặc IP server)
- Port: `3306` (mặc định)
- Character Set: `utf8mb4`

---

## Ví dụ Queries

### Kiểm tra danh sách nhân viên

```sql
-- Đếm tổng số nhân viên (theo id)
SELECT COUNT(*) AS tong_ban_ghi FROM employees;

-- Đếm theo từng mã nhân viên
SELECT COUNT(DISTINCT ma_nhan_vien) AS tong_ma_nhan_vien FROM employees;

-- Liệt kê chi tiết nhân viên
SELECT id,
       ma_nhan_vien,
       ho_ten,
       chuc_danh,
       phong_ban,
       bo_phan,
       ngay_gia_nhap,
       email,
       trang_thai,
       created_at
FROM employees
ORDER BY id;
```

### Tạo nhân viên mới

```sql
INSERT INTO employees (
    ho_ten, 
    chuc_danh, 
    phong_ban, 
    bo_phan, 
    ngay_gia_nhap, 
    email,
    password
) VALUES (
    'Nguyễn Văn A',
    'Nhân viên IT',
    'IT',
    'Phát triển phần mềm',
    '2024-01-15',
    'nguyenvana@rmg.com',
    '$2y$10$...' -- password đã hash
);
```

### Thêm vật dụng cho nhân viên

```sql
INSERT INTO equipment_assignments (
    employee_id,
    phong_ban,
    ten_vat_dung,
    so_luong,
    trang_thai
) VALUES (
    1, -- ID nhân viên
    'IT',
    'Laptop Dell',
    1,
    'ASSIGNED'
);
```

### Lấy danh sách nhân viên với vật dụng

```sql
SELECT 
    e.ho_ten,
    e.chuc_danh,
    e.phong_ban,
    e.email,
    COUNT(eq.id) as tong_vat_dung
FROM employees e
LEFT JOIN equipment_assignments eq ON e.id = eq.employee_id 
    AND eq.trang_thai != 'RETURNED'
WHERE e.trang_thai = 'ACTIVE'
GROUP BY e.id;
```

---

## Bảo mật

1. **Password Hashing:** Luôn hash password bằng bcrypt trước khi lưu vào database
2. **SQL Injection:** Sử dụng prepared statements khi query
3. **Validation:** Validate dữ liệu input trước khi insert/update
4. **Indexes:** Đã tạo indexes để tối ưu hiệu suất query

---

## Ghi chú

- Database sử dụng `ON DELETE CASCADE` cho foreign key `equipment_assignments.employee_id`
- Khi xóa nhân viên, tất cả vật dụng được phân công sẽ tự động bị xóa
- Timestamps (`created_at`, `updated_at`) tự động cập nhật
- Email phải là UNIQUE để tránh trùng lặp
