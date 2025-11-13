# Tổng Quan Giao Diện HR Demo

Tài liệu này phác thảo giao diện hiện tại của ứng dụng HR Demo sau đợt cập nhật gần nhất. Mục tiêu là mô tả ngắn gọn màu sắc, bố cục và hiệu ứng để dev/design bám sát khi mở rộng tính năng.

## Ngôn ngữ Thiết kế Chủ đạo

- **Chế độ:** Light Mode kết hợp Fluent Design và một phần Glassmorphism.
- **Bảng màu:**
  - Nền tổng: gradient `#f8f9ff → #eef2fb → #ffffff`.
  - Tông nhấn: Electric Blue (`#2563eb`, `#3b82f6`, `#0f5ff3`) và các gradient teal/lavender.
  - Cảnh báo: đỏ mềm, cam trung tính cho trạng thái destructive/secondary.
- **Chữ:** Inter (400 → 700). Tiêu đề ~1.4–1.6rem, nội dung 0.9–1rem.
- **Độ sâu:** Shadow từ nhẹ (`0 14px 32px -26px rgba(15,23,42,0.18)`) tới mạnh cho modal (`0 20px 50px rgba(15,23,42,0.2)`).
- **Bo góc:** 0.75–1.2rem tùy dạng thẻ; chip dùng bo dạng pill.

## Khung ứng dụng

- **Header chính:** Sticky, nền trắng mờ (blur 16px), border Electric Blue.
- **Sidebar:** Trắng mờ hơi, gradient nhẹ; item active có viền/lấp lánh Electric Blue.
- **Cuộn:** Thanh cuộn tùy biến màu xanh.

## Trang Employee Dashboard (vai trò Nhân viên)

### Thẻ “Thông tin nhân viên”
- Nền navy gradient (`#1f2f4c → #15243d`), 92% opacity.
- Header gồm avatar viên gradient, tên, chức danh, mã nhân viên dạng pill, và ba nút hành động ở phía phải (Chỉnh sửa/Cập nhật vật dụng/Xóa).
- Các box thông tin có nền `rgba(46, 62, 82, 0.72)`, chữ trắng, glow Electric Blue khi hover/focus.
- Loading state: spinner Electric Blue.

**Hover/Focus:**
- Field di chuyển `translateY(-1px)` + border chuyển từ nhạt sang Electric Blue, glow `0 0 0 4px rgba(59, 130, 246, 0.22)`.
- Status badge, avatar giữ glow nhẹ khi hover (để gợi click nhưng không thay đổi bố cục).

### Thao tác nhanh
- Hai card cân đối 50/50 (Xin nghỉ phép / Xin nghỉ việc).
- Icon lớn (24px) gradient xanh tím, nằm bên trái chữ.
- Hover: card nhấc `translateY(-6px)`, border đổi Electric Blue, shadow `0 26px 48px -24px rgba(59,130,246,0.45)`.
- Focus: thêm outline glow `0 0 0 4px rgba(59,130,246,0.22)`.

## Trang Employee Table (vai trò HR/Admin)

### Bảng nhân viên
- Header card trắng, shadow nhẹ.
- Dòng bảng hover: nền `rgba(37, 99, 235, 0.08)`, shadow nhô nhẹ.

### Modal chi tiết nhân viên
- Overlay đen trong suốt 60% + blur 18px.
- Modal trắng, border Electric Blue 1px, shadow sâu.
- Header: tên + chức danh bên trái, mã nhân viên pill ngay dưới, nhóm nút hành động (compact) bên phải:
  - Nút cao ~40px, icon 16px, gradient pastel (xanh tím, xanh lam, đỏ hồng).
  - Chữ đen/xanh đậm; hover sáng màu + glow nhẹ.
- Nội dung: form và thẻ thông tin nền trắng/translucent, border xám nhạt.
- Footer (chế độ sửa): nút “Lưu” gradient xanh, glow khi hover; “Hủy” nền trắng, border xám nhạt.

**Hover/Effect chi tiết:**
- Nút hành động: `transform: translateY(-2px)` + shadow `0 18px 40px -24px` khi hover.
- Icon đổi tông đậm hơn (đỏ cho Xóa).
- Input/Select focus: border Electric Blue, glow `0 0 0 4px rgba(59,130,246,0.18)`.

## Module khác
- **Leave Request:** thẻ mềm, tab Fluent; Quick Action trỏ vào đây.
- **Các modal khác:** cùng overlay, cùng phong cách mặt nạ trắng.

## Điểm nhấn tương tác
- Hover luôn kèm lift nhỏ (`-1px` → `-6px`) + shadow/glow.
- Các trạng thái disabled giảm opacity 0.5–0.7.
- Transition dùng `transition: all 0.2s ease` hoặc cubic bezier chuẩn.

## Hướng phát triển
- Áp dụng bộ nút compact cho bảng danh sách ngoài modal.
- Mở rộng Thao tác nhanh với shortcut cá nhân.
- Xây dựng bộ chuẩn màu cho chế độ Dark Mode.

Tài liệu sẽ giúp dev/design đồng bộ phong cách Light Mode hiện tại và giữ trải nghiệm nhất quán khi phát triển tiếp theo.
