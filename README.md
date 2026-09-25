# 🎲 TÀI XỈU VIP CASINO (3D 6-MẶT, TÀI KHOẢN & NẠP TIỀN BIDV)

Một dự án game web cờ bạc mô phỏng **Tài Xỉu (Sic Bo)** cao cấp với đồ họa **xúc xắc 3D 6 mặt chuẩn xác**, hệ thống **Đăng nhập / Đăng ký tài khoản độc lập**, cơ chế **Nạp tiền chuyển khoản ngân hàng BIDV (STK: 8860252059)** tự động sinh mã VietQR Napas và sẵn sàng **deploy public lên Vercel** chỉ trong 1 phút.

---

## 📌 1. Luật Chơi Chuẩn
- **Tung 3 hột xúc xắc 3D 6 mặt** (từ 1 đến 6 điểm mỗi hột).
- **TÀI (Over)**: Tổng điểm từ **11 đến 17** điểm (Tỷ lệ 1 ăn 2).
- **XỈU (Under)**: Tổng điểm từ **4 đến 10** điểm (Tỷ lệ 1 ăn 2).
- **Cửa Phụ**:
  - **BÃO (Bộ ba đồng nhất)**: 3 hột ra cùng một mặt (1-1-1 ... 6-6-6) - Tỷ lệ **1 ăn 30**!
  - **CHẴN / LẺ**: Tổng điểm là chẵn hoặc lẻ - Tỷ lệ **1 ăn 1.95**.

---

## 💎 2. Các Tính Năng Mới Nâng Cấp

### 🎲 Xúc Xắc 3D 6 Mặt Đẳng Cấp
- Cả 6 mặt đều được dựng 3D chuẩn xác bằng CSS 3D Transforms (`front`, `back`, `top`, `bottom`, `left`, `right`).
- Lưới 3x3 căn chỉnh từng chấm tròn (pips): Mặt 1 (đỏ to giữa), Mặt 2 (2 chéo đen), Mặt 3 (3 chéo đen), Mặt 4 (4 đỏ ở 4 góc), Mặt 5 (4 góc + 1 tâm đen), Mặt 6 (6 chấm đen).
- Góc nghiêng phối cảnh 3D Isometric + bóng tiếp xúc (`dice-shadow`) chân thực dưới đáy đĩa.

### 👤 Hệ Thống Tài Khoản Độc Lập (Auth System)
- Mỗi người chơi có một tài khoản riêng biệt:
  - **Đăng ký**: Tên tài khoản, Mật khẩu. Nhận ngay **100.000 ₫** tiền vốn khởi nghiệp tân thủ!
  - **Đăng nhập**: Phân tách số dư, lịch sử cược và lịch sử nạp tiền riêng của từng tài khoản.
  - **Chơi Nhanh (Khách Demo)**: Bấm 1 chạm để thử nghiệm ngay lập tức.
  - Dữ liệu tài khoản được lưu trữ an toàn trong `localStorage`.

### 💳 Nạp Tiền Chuyển Khoản BIDV (STK: 8860252059) & VietQR
- **Ngân Hàng**: BIDV (Ngân hàng TMCP Đầu tư và Phát triển Việt Nam)
- **Số Tài Khoản**: `8860252059`
- **Mã VietQR Tự Động**: Khi chọn hoặc nhập số tiền, hệ thống tự động sinh ảnh mã QR chuẩn Napas 247. Người chơi mở ứng dụng ngân hàng (BIDV SmartBanking, MB, Vietcombank, Momo, v.v.) quét mã sẽ tự động điền STK 8860252059, số tiền và nội dung chuyển khoản!
- **Kiểm Tra & Cộng Tiền**: Bấm nút "Tôi Đã Chuyển Tiền", hệ thống mô phỏng kiểm tra đối soát giao dịch trong 3 giây và tự động cộng tiền ngay vào số dư tài khoản của người chơi.
- **Lịch Sử Nạp Tiền**: Lưu lại chi tiết mã giao dịch, số tiền nạp, ngày giờ và trạng thái.

---

## 🚀 3. Hướng Dẫn Public Lên Vercel (1 Phút)

Dự án đã được cấu hình sẵn file `vercel.json` chuẩn và khởi tạo Git repository sẵn sàng deploy.

### Cách 1: Deploy qua GitHub (Khuyên Dùng - Hoàn Toàn Miễn Phí)
1. Tạo một repository mới trên [GitHub.com](https://github.com/new) (ví dụ: `tai-xiu-casino`).
2. Mở Terminal và đẩy mã nguồn lên GitHub:
   ```bash
   cd /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game
   git remote add origin https://github.com/<username-cua-ban>/tai-xiu-casino.git
   git branch -M main
   git push -u origin main
   ```
3. Truy cập [vercel.com](https://vercel.com) -> Đăng nhập bằng GitHub -> Bấm **Add New...** -> **Project** -> Chọn repo `tai-xiu-casino` -> Bấm **Deploy**.
4. Sau 15 giây, bạn sẽ nhận được link web công khai dạng:
   👉 `https://tai-xiu-casino-xxx.vercel.app`

### Cách 2: Deploy bằng Vercel CLI (Trực tiếp từ máy tính)
Nếu bạn có Node.js / Vercel CLI, chỉ cần chạy lệnh sau ngay trong thư mục:
```bash
cd /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game
npx vercel --prod
```
Làm theo hướng dẫn trên màn hình để xác nhận tài khoản Vercel, website sẽ được publish live ngay lập tức!

---

## 💻 4. Trải Nghiệm Trên Máy Local

Mở trực tiếp trên macOS:
```bash
open /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game/index.html
```

Hoặc chạy máy chủ local:
```bash
cd /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game
python3 -m http.server 8080
```
Truy cập: [http://localhost:8080](http://localhost:8080)
