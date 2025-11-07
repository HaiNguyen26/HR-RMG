# 🪟 HƯỚNG DẪN CHẠY TRONG POWERSHELL / CMD (Windows)

## 🎯 Cách nhanh nhất - Một lệnh duy nhất!

### Bước 1: Mở PowerShell hoặc Command Prompt
- **PowerShell:** Nhấn `Windows + X` → Chọn "Windows PowerShell" hoặc "Terminal"
- **CMD:** Nhấn `Windows + R` → Gõ `cmd` → Enter

### Bước 2: Di chuyển đến thư mục dự án
```powershell
cd d:\Web-App-HR-Demo
```

### Bước 3: Chạy ứng dụng

**Cách A: Tự động fix port rồi chạy (Khuyến nghị)**
```powershell
npm run dev:safe
```

**Cách B: Chạy bình thường**
```powershell
npm run dev
```

**Cách C: Dùng batch file (Double-click)**
- Double-click file `start_dev.bat`
- Hoặc chạy trong PowerShell/CMD:
```powershell
.\start_dev.bat
```

---

## 📋 Các lệnh có sẵn

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy cả backend và frontend |
| `npm run dev:safe` | Fix port rồi chạy (khuyến nghị) |
| `npm run fix:ports` | Chỉ fix port, không chạy |
| `npm run install:all` | Cài đặt tất cả dependencies |

---

## 🔧 Nếu gặp lỗi "Port already in use"

### Cách 1: Dùng lệnh tự động fix
```powershell
npm run dev:safe
```

### Cách 2: Fix port thủ công
```powershell
# Chạy script fix port
.\scripts\fix_port.bat

# Hoặc dùng npm script
npm run fix:ports

# Hoặc kill tất cả Node.js
taskkill /F /IM node.exe
```

Sau đó chạy lại:
```powershell
npm run dev
```

---

## ✅ Kiểm tra hoạt động

Sau khi chạy `npm run dev`, bạn sẽ thấy:

**Terminal hiển thị:**
```
[0] Backend server running on http://localhost:3000
[1] Frontend server running on http://localhost:3001
```

**Truy cập:**
- **Frontend:** http://localhost:3001 (tự động mở browser)
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

---

## 🛑 Dừng ứng dụng

Nhấn `Ctrl + C` trong terminal → Cả 2 servers sẽ dừng

---

## 💡 Lưu ý

1. **Lần đầu tiên:** Chạy `npm run install:all` để cài đặt dependencies
2. **Port cấu hình:**
   - Backend: Port 3000 (trong `backend/.env`)
   - Frontend: Port 3001 (trong `frontend/.env`)
3. **Database:** Đảm bảo PostgreSQL đang chạy và database đã được tạo
4. **Logs:** Cả backend và frontend hiển thị logs trong cùng một terminal với prefix `[0]` và `[1]`

---

## 🔍 Troubleshooting

### Lỗi: "npm is not recognized"
**Giải pháp:** Cài đặt Node.js từ https://nodejs.org/

### Lỗi: "Port 3000 already in use"
**Giải pháp:** 
```powershell
npm run dev:safe
# hoặc
.\scripts\fix_port.bat
```

### Lỗi: "Cannot find module"
**Giải pháp:**
```powershell
npm run install:all
```

### Lỗi: "Database connection error"
**Giải pháp:**
1. Kiểm tra PostgreSQL đang chạy
2. Kiểm tra `backend/.env` có đúng password không
3. Kiểm tra database `HR_Management_System` đã được tạo chưa

---

**Xem [CHAY_NHANH.md](CHAY_NHANH.md) hoặc [HUONG_DAN_KHOI_DONG.md](HUONG_DAN_KHOI_DONG.md) để biết thêm chi tiết!**
