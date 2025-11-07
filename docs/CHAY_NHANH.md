# ⚡ CHẠY NHANH - HR Management System

## 🎯 Cách nhanh nhất - Một lệnh duy nhất!

### Bước 1: Cài đặt dependencies (chỉ lần đầu)
```bash
# Từ thư mục gốc (d:\Web-App-HR-Demo)
npm run install:all
```

### Bước 2: Chạy ứng dụng

**Cách A: Tự động fix port (Khuyến nghị nếu gặp lỗi port)**
```bash
npm run dev:safe
```

**Cách B: Chạy bình thường**
```bash
npm run dev
```

**Xong!** 🎉
- Backend: http://localhost:3000
- Frontend: http://localhost:3001 (tự động mở browser)

---

## 🔧 Nếu gặp lỗi "Port already in use"

**Cách 1: Dùng script tự động fix port**
```bash
npm run dev:safe
```

**Cách 2: Fix port thủ công trước**
```bash
# Windows
scripts\fix_port.bat

# Git Bash
./scripts/fix_port.sh

# Hoặc dùng npm script
npm run fix:ports
```

Sau đó chạy lại:
```bash
npm run dev
```

---

## 📋 Các cách khác

### Cách 2: Dùng script (tự động fix port)
```bash
# Windows
start_dev.bat

# Git Bash
./start_dev.sh
```

### Cách 3: Chạy riêng biệt
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

---

## 🛑 Dừng ứng dụng

Nhấn `Ctrl+C` trong terminal đang chạy `npm run dev`

---

## ⚙️ Yêu cầu trước khi chạy

1. ✅ PostgreSQL đang chạy
2. ✅ Database `HR_Management_System` đã được tạo
3. ✅ Đã import schema từ `database/database_schema_postgresql.sql`
4. ✅ File `backend/.env` đã được cấu hình

---

## 📝 Lưu ý

- Lần đầu tiên cần chạy `npm run install:all` để cài đặt tất cả dependencies
- `npm run dev` sử dụng `concurrently` để chạy cả backend và frontend trong một terminal
- `npm run dev:safe` tự động fix port trước khi chạy (khuyến nghị)
- Backend sử dụng `nodemon` (tự động restart khi code thay đổi)
- Frontend sử dụng `react-scripts` (hot reload khi code thay đổi)

---

**Xem [Hướng dẫn khởi động chi tiết](HUONG_DAN_KHOI_DONG.md) để biết thêm chi tiết!**
