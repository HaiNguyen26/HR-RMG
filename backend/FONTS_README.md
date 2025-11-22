# Hướng dẫn cài đặt Font cho PDF Tiếng Việt

Để PDF hiển thị đúng tiếng Việt, bạn cần tải và đặt font Noto Sans vào thư mục `backend/fonts`.

## Cách 1: Tự động tải (Khuyến nghị)

Chạy script sau từ thư mục `backend`:

```bash
node download-fonts.js
```

## Cách 2: Tải thủ công

1. Truy cập: https://fonts.google.com/noto/specimen/Noto+Sans
2. Tải về 2 font:
   - NotoSans-Regular.ttf
   - NotoSans-Bold.ttf
3. Đặt vào thư mục: `backend/fonts/`

## Kiểm tra

Sau khi tải font, khởi động lại backend server. Code sẽ tự động phát hiện và sử dụng font Noto Sans. Nếu không có font, hệ thống sẽ sử dụng Times-Roman mặc định (có thể hiển thị không đúng tiếng Việt).

## Cấu trúc thư mục

```
backend/
  fonts/
    NotoSans-Regular.ttf
    NotoSans-Bold.ttf
```


