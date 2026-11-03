# Đăng nhập hai tài khoản E2E trên máy local

1. Mở `e2e/.local/credentials.json` bằng editor **trên máy này**.
2. Lấy `email` và `password` ở alias `student` (Nguyễn Minh Khoa tổng hợp) hoặc `company` (Sao Mai Technology E2E).
3. Mở http://localhost:5173/login; đăng nhập, refresh và vào workspace tương ứng.

File bị gitignore và không nằm trên GitHub/PR. Không paste password/JWT/file credentials vào chat, issue, log hay screenshot chia sẻ. Alias phụ dùng negative tests; không dùng dữ liệu thật hay email bên ngoài.

NTFS ACL của file trên máy này đã được giới hạn cho user Windows sở hữu và SYSTEM. Chạy runner từ phiên PowerShell của chủ máy; một sandbox identity khác có thể cần quyền thực thi phù hợp để đọc file. Không mở quyền cho toàn bộ Users chỉ để chia sẻ credentials.

Nếu mất file, phục hồi từ local backup an toàn. Không reset DB hoặc tạo account trùng để thay mật khẩu. Setup sẽ báo collision khi email đã có mà credentials không khớp. Hướng dẫn rerun: [e2e/README.md](../../e2e/README.md).
