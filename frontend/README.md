# Frontend - HR Management System

## Cấu trúc Module

Frontend được tách thành các module riêng biệt để dễ phát triển và bảo trì:

```
frontend/src/
├── components/          # React Components
│   ├── Sidebar/        # Sidebar navigation
│   │   ├── Sidebar.js
│   │   └── Sidebar.css
│   │
│   ├── Dashboard/      # Dashboard page
│   │   ├── Dashboard.js
│   │   ├── Dashboard.css
│   │   ├── StatisticsCards.js
│   │   └── StatisticsCards.css
│   │
│   ├── EmployeeTable/  # Employee table component
│   │   ├── EmployeeTable.js
│   │   └── EmployeeTable.css
│   │
│   ├── EmployeeForm/   # Employee form component
│   │   ├── EmployeeForm.js
│   │   └── EmployeeForm.css
│   │
│   └── EquipmentAssignment/  # Equipment assignment component
│       ├── EquipmentAssignment.js
│       └── EquipmentAssignment.css
│
├── services/           # API Services
│   └── api.js         # API calls
│
├── App.js             # Main App component
├── App.css            # App styles
├── index.js           # Entry point
└── index.css          # Global styles
```

## Lợi ích của cấu trúc module

1. **Tách biệt trách nhiệm**: Mỗi component có trách nhiệm riêng
2. **Dễ bảo trì**: Sửa lỗi ở một module không ảnh hưởng module khác
3. **Dễ mở rộng**: Thêm module mới dễ dàng
4. **Tái sử dụng**: Component có thể tái sử dụng ở nhiều nơi
5. **Testing**: Dễ test từng module riêng biệt

## Thêm Module mới

Để thêm module mới (ví dụ: `Reports`):

1. Tạo thư mục component:
   ```bash
   mkdir frontend/src/components/Reports
   ```

2. Tạo file component:
   ```javascript
   // frontend/src/components/Reports/Reports.js
   import React from 'react';
   import './Reports.css';

   const Reports = () => {
     return <div>Reports Module</div>;
   };

   export default Reports;
   ```

3. Tạo file CSS:
   ```css
   /* frontend/src/components/Reports/Reports.css */
   .reports-container {
     /* styles */
   }
   ```

4. Import và sử dụng trong `App.js`:
   ```javascript
   import Reports from './components/Reports/Reports';
   ```

5. Thêm vào Sidebar menu (nếu cần):
   ```javascript
   // frontend/src/components/Sidebar/Sidebar.js
   const menuItems = [
     // ... existing items
     { id: 'reports', label: 'Báo cáo', icon: '📊' },
   ];
   ```

## API Service

File `services/api.js` quản lý tất cả API calls. Thêm API mới:

```javascript
// services/api.js
export const reportsAPI = {
  getReports: () => api.get('/reports'),
  createReport: (data) => api.post('/reports', data),
};
```

## Chạy Development

```bash
cd frontend
npm install
npm start
```

Frontend sẽ chạy tại `http://localhost:3001` (hoặc port khác nếu 3001 đã được sử dụng)

## Build Production

```bash
npm run build
```

Output sẽ được tạo trong thư mục `build/`
