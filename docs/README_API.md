# HR Management System - API Documentation

## Tổng quan

API endpoints cho hệ thống quản lý nhân sự, sử dụng **Node.js + Express** và **PostgreSQL**.

**Base URL:** `http://localhost:3000`

---

## API Endpoints

### 1. Employees API

#### GET `/api/employees`

Lấy danh sách tất cả nhân viên đang hoạt động.

**Response:**
```json
{
  "success": true,
  "message": "Danh sách nhân viên",
  "data": [
    {
      "id": 1,
      "ho_ten": "Nguyễn Văn A",
      "chuc_danh": "Nhân viên IT",
      "phong_ban": "IT",
      "bo_phan": "Phát triển phần mềm",
      "ngay_gia_nhap": "2024-01-15",
      "email": "nguyenvana@rmg.com",
      "trang_thai": "ACTIVE",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

#### POST `/api/employees`

Tạo nhân viên mới.

**Request Body:**
```json
{
  "hoTen": "Nguyễn Văn A",
  "chucDanh": "Nhân viên IT",
  "phongBan": "IT",
  "boPhan": "Phát triển phần mềm",
  "ngayGiaNhap": "2024-01-15",
  "email": "nguyenvana@rmg.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tạo nhân viên thành công",
  "data": {
    "id": 1,
    "ho_ten": "Nguyễn Văn A",
    "chuc_danh": "Nhân viên IT",
    "phong_ban": "IT",
    "bo_phan": "Phát triển phần mềm",
    "ngay_gia_nhap": "2024-01-15",
    "email": "nguyenvana@rmg.com",
    "trang_thai": "ACTIVE"
  }
}
```

**Lưu ý:** Password mặc định là `RMG123@` (đã được hash tự động bằng bcrypt).

---

### 2. Equipment API

#### GET `/api/equipment?employee_id=1`

Lấy danh sách vật dụng của nhân viên.

**Query Parameters:**
- `employee_id` (required): ID nhân viên

**Response:**
```json
{
  "success": true,
  "message": "Danh sách vật dụng",
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "phong_ban": "IT",
      "ten_vat_dung": "Laptop Dell",
      "so_luong": 1,
      "trang_thai": "PENDING",
      "ngay_phan_cong": "2024-01-15",
      "ngay_tra": null,
      "ghi_chu": null,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

#### POST `/api/equipment`

Thêm vật dụng cho nhân viên.

**Request Body:**
```json
{
  "employeeId": 1,
  "phongBan": "IT",
  "equipmentList": [
    {
      "tenVatDung": "Laptop Dell",
      "soLuong": 1
    },
    {
      "tenVatDung": "Mouse Logitech",
      "soLuong": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thêm vật dụng thành công",
  "data": {
    "inserted_ids": [1, 2]
  }
}
```

---

### 3. Statistics API

#### GET `/api/statistics`

Lấy thống kê tỷ lệ nhân viên theo phòng ban.

**Response:**
```json
{
  "success": true,
  "message": "Thống kê nhân viên",
  "data": {
    "tongNhanVien": 125,
    "tyLeTheoPhongBan": [
      {
        "phongBan": "IT",
        "soLuong": 56,
        "tyLePhanTram": "44.80"
      },
      {
        "phongBan": "HR",
        "soLuong": 31,
        "tyLePhanTram": "24.80"
      },
      {
        "phongBan": "ACCOUNTING",
        "soLuong": 25,
        "tyLePhanTram": "20.00"
      },
      {
        "phongBan": "OTHER",
        "soLuong": 13,
        "tyLePhanTram": "10.40"
      }
    ]
  }
}
```

---

## Error Responses

Tất cả các lỗi đều trả về format:

```json
{
  "success": false,
  "message": "Thông báo lỗi"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (thiếu hoặc sai dữ liệu)
- `404` - Not Found
- `500` - Internal Server Error

---

## Ví dụ sử dụng với JavaScript/Fetch

### Lấy danh sách nhân viên

```javascript
fetch('http://localhost:3000/api/employees')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Danh sách nhân viên:', data.data);
    }
  });
```

### Tạo nhân viên mới

```javascript
fetch('http://localhost:3000/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    hoTen: 'Nguyễn Văn A',
    chucDanh: 'Nhân viên IT',
    phongBan: 'IT',
    boPhan: 'Phát triển phần mềm',
    ngayGiaNhap: '2024-01-15',
    email: 'nguyenvana@rmg.com'
  })
})
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Tạo nhân viên thành công:', data.data);
    } else {
      console.error('Lỗi:', data.message);
    }
  });
```

### Thêm vật dụng

```javascript
fetch('http://localhost:3000/api/equipment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    employeeId: 1,
    phongBan: 'IT',
    equipmentList: [
      { tenVatDung: 'Laptop Dell', soLuong: 1 },
      { tenVatDung: 'Mouse Logitech', soLuong: 1 }
    ]
  })
})
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Thêm vật dụng thành công');
    }
  });
```

---

## Bảo mật

1. **Password Hashing:** Password được hash tự động bằng bcrypt (cost: 10)
2. **SQL Injection:** Sử dụng parameterized queries (pg library)
3. **Input Validation:** Validate tất cả input trước khi xử lý
4. **CORS:** Đã cấu hình CORS headers (có thể chỉnh sửa trong production)

---

## Lưu ý

- Đảm bảo database đã được import từ `database/database_schema_postgresql.sql`
- Kiểm tra thông tin kết nối database trong file `.env`
- Trong production, nên thêm authentication/authorization (JWT, Passport.js)
- Cấu hình CORS phù hợp với domain frontend
- Sử dụng connection pooling để tối ưu hiệu suất
