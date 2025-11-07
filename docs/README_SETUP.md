# HR Management System - Setup Guide

## Tech Stack

- **Backend:** Node.js + Express.js
- **Frontend:** React.js
- **Database:** PostgreSQL
- **Password Hashing:** bcrypt

---

## Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)
- npm hoặc yarn

---

## Database Setup

### 1. Cài đặt PostgreSQL

Đảm bảo PostgreSQL đã được cài đặt và đang chạy.

### 2. Tạo Database

```bash
# Đăng nhập PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE HR_Management_System
WITH ENCODING = 'UTF8'
LC_COLLATE = 'en_US.UTF-8'
LC_CTYPE = 'en_US.UTF-8';

# Kết nối vào database
\c HR_Management_System
```

### 3. Import Schema

```bash
psql -U postgres -d HR_Management_System -f database/database_schema_postgresql.sql
```

Hoặc copy nội dung file `database/database_schema_postgresql.sql` và chạy trong psql.

---

## Backend Setup

### 1. Cài đặt Dependencies

```bash
cd backend
npm install
```

### 2. Cấu hình Environment

Copy file `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=HR_Management_System
DB_USER=postgres
DB_PASSWORD=your_password

PORT=3000
NODE_ENV=development

DEFAULT_PASSWORD=RMG123@
```

### 3. Chạy Backend

**Development mode (với nodemon):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Backend sẽ chạy tại: `http://localhost:3000`

---

## Frontend Setup

### 1. Cài đặt Dependencies

```bash
cd frontend
npm install
```

### 2. Cấu hình API URL

File `.env` trong thư mục frontend (tạo mới nếu chưa có):

```env
REACT_APP_API_URL=http://localhost:3000
```

### 3. Chạy Frontend

```bash
npm start
```

Frontend sẽ chạy tại: `http://localhost:3001` (hoặc port khác nếu 3001 đã được sử dụng)

---

## Project Structure

```
hr-management-system/
├── backend/
│   ├── config/
│   │   └── database.js       # Database connection
│   ├── routes/
│   │   ├── employees.js      # Employee routes
│   │   ├── equipment.js      # Equipment routes
│   │   └── statistics.js     # Statistics routes
│   ├── .env                  # Environment variables
│   ├── .env.example          # Environment template
│   ├── package.json
│   └── server.js             # Express server
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── services/         # API services
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── public/
│
├── database/
│   └── database_schema_postgresql.sql
├── docs/
│   ├── README_SETUP.md
│   └── README_API.md
```

---

## API Endpoints

### Base URL: `http://localhost:3000`

### Employees
- `GET /api/employees` - Lấy danh sách nhân viên
- `POST /api/employees` - Tạo nhân viên mới

### Equipment
- `GET /api/equipment?employee_id=1` - Lấy danh sách vật dụng
- `POST /api/equipment` - Thêm vật dụng

### Statistics
- `GET /api/statistics` - Lấy thống kê

Chi tiết xem file `README_API.md`

---

## Testing

### Test Database Connection

```bash
cd backend
node -e "require('./config/database').query('SELECT NOW()', (err, res) => { console.log(err || res.rows); process.exit(); })"
```

### Test API

```bash
# Health check
curl http://localhost:3000/health

# Get employees
curl http://localhost:3000/api/employees

# Create employee
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "hoTen": "Nguyễn Văn A",
    "chucDanh": "Nhân viên IT",
    "phongBan": "IT",
    "boPhan": "Phát triển phần mềm",
    "ngayGiaNhap": "2024-01-15",
    "email": "nguyenvana@rmg.com"
  }'
```

---

## Troubleshooting

### Database Connection Error

1. Kiểm tra PostgreSQL đang chạy:
   ```bash
   # Windows
   services.msc (tìm PostgreSQL service)
   
   # Linux/Mac
   sudo systemctl status postgresql
   ```

2. Kiểm tra thông tin trong file `.env`

3. Test connection:
   ```bash
   psql -U postgres -d HR_Management_System
   ```

### Port Already in Use

Nếu port 3000 đã được sử dụng, thay đổi trong file `.env`:
```env
PORT=3001
```

### CORS Error

Đảm bảo CORS đã được cấu hình trong `backend/server.js`:
```javascript
app.use(cors());
```

---

## Development Tips

1. **Backend Auto-reload:** Sử dụng `npm run dev` để tự động reload khi code thay đổi
2. **Database Queries:** Sử dụng pgAdmin hoặc DBeaver để quản lý database
3. **API Testing:** Sử dụng Postman hoặc Thunder Client (VSCode extension)
4. **React DevTools:** Cài đặt React Developer Tools extension cho browser

---

## Production Deployment

1. Set `NODE_ENV=production` trong `.env`
2. Build React app: `cd frontend && npm run build`
3. Serve frontend với nginx hoặc serve static files từ Express
4. Sử dụng process manager như PM2 cho Node.js
5. Cấu hình SSL/HTTPS
6. Thêm authentication/authorization
7. Setup database backups

---

## Notes

- Password mặc định cho nhân viên mới: `RMG123@`
- Database sử dụng UTF8 encoding để hỗ trợ tiếng Việt
- API sử dụng bcrypt để hash password (cost: 10)
