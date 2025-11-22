# 🚀 HƯỚNG DẪN CHẠY 2 INSTANCE CÙNG LÚC

## 📋 Mục đích
Chạy ứng dụng trên 2 port khác nhau để test với 2 tài khoản cùng lúc:
- **Port 3001**: Dành cho HR
- **Port 3002**: Dành cho Nhân viên

## ⚡ Cách chạy nhanh nhất

### Từ thư mục gốc dự án (d:\Web-App-HR-Demo):

```bash
npm run dev:dual
```

Lệnh này sẽ chạy:
- ✅ Backend trên port 3000
- ✅ Frontend HR trên port 3001
- ✅ Frontend Nhân viên trên port 3002

---

## 🔧 Chạy từng instance riêng biệt

### Terminal 1 - Backend:
```bash
npm run dev:backend
```

### Terminal 2 - Frontend HR (Port 3001):
```bash
cd frontend
npm run dev:hr
```

### Terminal 3 - Frontend Nhân viên (Port 3002):
```bash
cd frontend
npm run dev:employee
```

---

## 📍 Truy cập ứng dụng

Sau khi chạy `npm run dev:dual`, truy cập:

- **HR Interface**: http://localhost:3001
- **Employee Interface**: http://localhost:3002
- **Backend API**: http://localhost:3000

---

## 🛑 Dừng ứng dụng

Nhấn `Ctrl + C` trong terminal để dừng tất cả các instance.

---

## ⚠️ Lưu ý

- Đảm bảo port 3000, 3001, 3002 chưa được sử dụng
- Nếu gặp lỗi port đã được sử dụng, chạy: `npm run fix:ports`
- Cả 2 instance frontend đều kết nối đến cùng 1 backend trên port 3000

