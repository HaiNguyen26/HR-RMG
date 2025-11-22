# HƯỚNG DẪN KIỂM TRA USER VÀ NOTIFICATIONS

## 1. Kiểm tra User đang đăng nhập

### Cách 1: Kiểm tra trong Browser Console
1. Mở ứng dụng và đăng nhập với tài khoản HR
2. Nhấn `F12` để mở Developer Tools
3. Chuyển sang tab **Console**
4. Gõ lệnh sau:
```javascript
// Kiểm tra user đang đăng nhập
const user = JSON.parse(localStorage.getItem('user'));
console.log('Current User:', user);
console.log('User ID:', user?.id);
console.log('Username:', user?.username);
console.log('Role:', user?.role);
```

### Cách 2: Kiểm tra trong Database
Chạy script kiểm tra:
```bash
node backend/scripts/check-users-notifications.js
```

Script này sẽ hiển thị:
- ✅ Danh sách tất cả HR users
- ✅ Thông báo cho mỗi HR user
- ✅ Thông báo chưa đọc
- ✅ Tất cả users trong hệ thống

## 2. Kiểm tra Notifications

### Kiểm tra notification sau khi từ chối đơn phỏng vấn:
```bash
node backend/scripts/test-notification.js
```

## 3. Các bước kiểm tra đầy đủ

### Bước 1: Kiểm tra HR Users tồn tại
```bash
node backend/scripts/check-users-notifications.js
```

Xác nhận:
- ✅ Có HR users với `trang_thai = 'ACTIVE'` hoặc `NULL`
- ✅ Ghi nhớ ID của HR user (ví dụ: ID 3 hoặc 5)

### Bước 2: Đăng nhập với HR account
- Username: `hr` hoặc `hr_admin`
- Password: (password của bạn)

### Bước 3: Kiểm tra user đang đăng nhập
Mở Console (F12) và chạy:
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('User ID:', user.id);
```

### Bước 4: Từ chối một đơn phỏng vấn
1. Đăng nhập với tài khoản quản lý ở tab khác
2. Vào "Phê duyệt phỏng vấn"
3. Từ chối một ứng viên
4. Quay lại dashboard của HR

### Bước 5: Kiểm tra notification đã được tạo
```bash
node backend/scripts/test-notification.js
```

Hoặc kiểm tra trong database:
```sql
SELECT * FROM notifications 
WHERE user_id IN (SELECT id FROM users WHERE UPPER(role) = 'HR')
AND title LIKE '%từ chối%'
ORDER BY created_at DESC
LIMIT 5;
```

## 4. Fix lỗi Loading Dashboard

Nếu dashboard bị loading mãi:

1. **Kiểm tra API `/api/statistics`:**
   - Mở Network tab (F12)
   - Xem request `/api/statistics` có thành công không
   - Kiểm tra response time

2. **Kiểm tra Console errors:**
   - Mở Console (F12)
   - Xem có lỗi JavaScript nào không

3. **Restart backend:**
   ```bash
   cd backend
   node server.js
   ```

## 5. Kiểm tra Polling Notifications

Mở Console và thêm logging:
```javascript
// Trong App.js, kiểm tra polling có chạy không
// Console sẽ log: "[notificationsAPI.getAll] Fetching with params: ..."
```

## 6. User IDs trong hệ thống

Từ kết quả script, các HR users:
- **User ID 3**: username `hr`, role `HR`, status `ACTIVE`
- **User ID 5**: username `hr_admin`, role `HR`, status `ACTIVE`

Đảm bảo bạn đăng nhập với một trong hai user này để nhận notifications.

## 7. Test thủ công

### Test notification khi từ chối đơn phỏng vấn:

1. **Tạo test notification:**
   ```javascript
   // Trong backend console hoặc script
   await notifyHrAdmins(
       'Quản lý đã từ chối ứng viên',
       'Quản lý trực tiếp đã từ chối ứng viên Test User (TEST). Ứng viên không đạt phỏng vấn.',
       null // candidate_id
   );
   ```

2. **Kiểm tra trong database:**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id IN (3, 5) 
   AND is_read = FALSE
   ORDER BY created_at DESC;
   ```

3. **Refresh dashboard và đợi 8 giây** - toast sẽ hiển thị

## 8. Debugging Tips

### Nếu không có notification:
- ✅ Kiểm tra backend log có message `[Interview Request Status Update] 📢 Calling notifyHrAdmins for REJECTED status` không
- ✅ Kiểm tra HR users có `trang_thai = 'ACTIVE'` hoặc `NULL` không
- ✅ Kiểm tra `notifyUsers` có được gọi không (check backend logs)

### Nếu có notification nhưng không hiển thị toast:
- ✅ Kiểm tra `currentUser.id` trong frontend có đúng với `user_id` trong notifications không
- ✅ Kiểm tra polling có chạy không (xem Console logs)
- ✅ Kiểm tra `is_read = FALSE` trong database
- ✅ Kiểm tra `lastCheckedNotificationId` có đang block không (reset bằng cách reload trang)


