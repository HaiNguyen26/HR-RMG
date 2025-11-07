# Hướng dẫn khởi động nhanh

## Cấu hình Database

File `.env` đã được tạo trong thư mục `backend/` với cấu hình:
- **Host:** localhost
- **Port:** 5432
- **Database:** HR_Management_System
- **User:** postgres
- **Password:** Hainguyen261097

## Khởi động ứng dụng

### Cách 1: Sử dụng Git Bash (Khuyến nghị cho Windows)

1. Mở Git Bash
2. Di chuyển đến thư mục project:
   ```bash
   cd /d/Web-App-HR-Demo
   ```
3. Cấp quyền thực thi cho script (chỉ cần làm 1 lần):
   ```bash
   chmod +x start.sh
   ```
4. Chạy script:
   ```bash
   ./start.sh
   ```

Script sẽ:
- Khởi động backend server (port 3000)
- Khởi động frontend server (port 3001)
- Hiển thị PID của các process
- Tạo file log: `backend.log` và `frontend.log`
- Nhấn `Ctrl+C` để dừng cả hai servers

### Cách 2: Sử dụng Windows Batch Script

Chạy file `start.bat` để khởi động cả backend và frontend:
```bash
start.bat
```

### Cách 3: Khởi động thủ công

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## Kiểm tra

1. **Backend API:** http://localhost:3000
   - Health check: http://localhost:3000/health
   - API Docs: http://localhost:3000/

2. **Frontend:** http://localhost:3001
   - Ứng dụng web sẽ tự động mở trong trình duyệt

## Logo

✅ Logo đã được copy vào thư mục `frontend/public/LogoRMG.png`
- Logo sẽ hiển thị trong sidebar khi ứng dụng chạy

## Lưu ý

1. **Database phải được tạo trước:**
   - Tạo database `HR_Management_System` trong PostgreSQL
   - Import schema từ file `database/database_schema_postgresql.sql`

2. **Nếu có lỗi kết nối database:**
   - Kiểm tra PostgreSQL đang chạy
   - Kiểm tra password trong file `backend/.env`
   - Kiểm tra database đã được tạo chưa

3. **Xem logs:**
   - Backend logs: `backend.log` (trong thư mục root)
   - Frontend logs: `frontend.log` (trong thư mục root)
   - Hoặc xem trực tiếp trong terminal nếu chạy thủ công

## Dừng ứng dụng

### Khi dùng Git Bash script:
- Nhấn `Ctrl+C` trong cửa sổ Git Bash đang chạy script
- Script sẽ tự động dừng cả backend và frontend

### Khi dùng batch script:
- Đóng cửa sổ terminal của backend và frontend
- Hoặc nhấn `Ctrl+C` trong mỗi terminal

### Dừng thủ công:
- Tìm PID của process và kill:
  ```bash
  # Trên Git Bash
  kill <BACKEND_PID>
  kill <FRONTEND_PID>
  ```
- Hoặc dừng process Node.js:
  ```bash
  taskkill /F /IM node.exe
  ```
