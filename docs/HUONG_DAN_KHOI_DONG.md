# 🚀 HƯỚNG DẪN KHỞI ĐỘNG TRANG WEB HR MANAGEMENT SYSTEM

## ⚠️ LỖI THƯỜNG GẶP VÀ CÁCH FIX

### 🔴 Lỗi: "EADDRINUSE: address already in use :::3000" hoặc "Something is already running on port 3000"
**Nguyên nhân:** Port 3000 hoặc 3001 đã được sử dụng bởi process khác

**Cách fix nhanh - Tự động (Khuyến nghị):**
```bash
# Dùng lệnh này - Tự động fix port rồi mới chạy
npm run dev:safe
```

**Cách fix thủ công:**
```bash
# Windows - Chạy file fix_port.bat
scripts\fix_port.bat

# Git Bash - Chạy script fix
chmod +x scripts/fix_port.sh
./scripts/fix_port.sh

# Hoặc dùng npm script
npm run fix:ports

# Hoặc thủ công:
taskkill /F /IM node.exe
```

Sau đó khởi động lại:
```bash
npm run dev
# hoặc
start.bat / ./start.sh
```

**💡 Tip:** Scripts `start_dev.bat` và `start_dev.sh` tự động fix port trước khi chạy!

---

## ⚡ CÁCH NHANH NHẤT - Chỉ 3 bước!

### Bước 1: Kiểm tra Database
- Mở pgAdmin4
- Đảm bảo database `HR_Management_System` đã được tạo
- Nếu chưa, tạo database và import file `database/database_schema_postgresql.sql`

### Bước 2: Khởi động Servers

**🎯 Cách SIÊU NHANH - Một lệnh duy nhất (Khuyến nghị):**
```bash
# Từ thư mục gốc dự án (d:\Web-App-HR-Demo)
npm run dev
```
Lệnh này sẽ chạy cả Backend và Frontend cùng lúc trong một terminal!

**Cách A: Dùng Git Bash Script**
```bash
cd /d/Web-App-HR-Demo
chmod +x start.sh    # Chỉ cần làm 1 lần đầu
./start.sh
```

**Cách B: Dùng Windows Batch**
- Double-click file `start.bat`

**Cách C: Chạy thủ công (2 terminal riêng biệt)**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Bước 3: Mở trình duyệt
- Truy cập: **http://localhost:3001**
- Trang web sẽ tự động mở!

---

## 📋 CHI TIẾT

### Cấu hình Database (Đã setup sẵn)
- File: `backend/.env`
- Host: localhost
- Port: 5432
- Database: HR_Management_System
- User: postgres
- Password: Hainguyen261097

### Các URL quan trọng
- **Frontend (Trang web):** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

---

## 🛑 DỪNG TRANG WEB

**Khi dùng Git Bash (`start.sh`):**
- Nhấn `Ctrl+C` trong cửa sổ Git Bash

**Khi dùng Batch (`start.bat`):**
- Đóng cửa sổ terminal của backend và frontend

**Dừng thủ công:**
```bash
# Tìm và kill process Node.js
taskkill /F /IM node.exe
```

---

## ❗ XỬ LÝ LỖI

### Lỗi kết nối database:
1. Kiểm tra PostgreSQL đang chạy
2. Kiểm tra password trong `backend/.env`
3. Kiểm tra database `HR_Management_System` đã được tạo

### Port đã được sử dụng:
- Backend (3000) hoặc Frontend (3001) đang chạy
- Dừng các process Node.js cũ trước khi khởi động lại

### Xem logs:
- Backend: `backend.log`
- Frontend: `frontend.log`

---

## ✅ KIỂM TRA HOẠT ĐỘNG

1. ✅ Backend chạy: Mở http://localhost:3000/health → Thấy `{"status":"OK"}`
2. ✅ Frontend chạy: Mở http://localhost:3001 → Thấy giao diện trang web
3. ✅ Logo hiển thị: Logo RMG xuất hiện ở sidebar bên trái

---

## 📝 LƯU Ý

- Lần đầu tiên cần cài đặt dependencies: `npm install` trong cả `