# 🎲 TÀI XỈU VIP CASINO (3 Xúc Xắc)

Một trò chơi mô phỏng cờ bạc **Tài Xỉu (Sic Bo)** chuẩn sòng bạc với đồ họa 3D, âm thanh sống động (Web Audio API không cần tải file ngoài), hỗ trợ tính năng **Nặn Bát kéo tay** độc đáo, bàn soi cầu và thống kê chi tiết.

---

## 📌 Luật Chơi Chuẩn (Theo Yêu Cầu)
- **Tung 3 hột xúc xắc (xí ngầu)** ngẫu nhiên từ 1 đến 6 điểm.
- **TÀI (Over)**: Tổng điểm 3 hột từ **11 đến 17** điểm (Tỷ lệ trả thưởng 1 ăn 2).
- **XỈU (Under)**: Tổng điểm 3 hột từ **4 đến 10** điểm (Tỷ lệ trả thưởng 1 ăn 2).
- **Cửa Phụ & Thưởng Lớn**:
  - **BÃO (Triple)**: 3 hột xúc xắc ra cùng 1 số (1-1-1, 2-2-2,... 6-6-6) - Tỷ lệ 1 ăn 30!
  - **CHẴN / LẺ**: Cược tổng điểm là số chẵn hay số lẻ - Tỷ lệ 1 ăn 1.95.

---

## 🚀 Tính Năng Nổi Bật
1. **Hộp Xóc & 3D Dice**: Xúc xắc 3D xoay lộn chân thực bằng CSS 3D transforms.
2. **Kéo Tay Nặn Bát (Interactive Bowl)**: Giữ và kéo chiếc bát hoàng gia để từ từ hé lộ từng con xúc xắc, tạo cảm giác hồi hộp như ngồi ở sòng casino thật! Có thể bấm "Mở Nhanh" hoặc bật/tắt chế độ nặn bát.
3. **Âm Thanh Chân Thực (Web Audio API)**: Tự tổng hợp âm thanh tiếng lách cách của phỉnh casino, tiếng xúc xắc va đập trong đĩa, tiếng trượt mở bát và chuông reo chiến thắng ăn tiền.
4. **Hệ Thống Phỉnh & Cược**:
   - Phỉnh 1K, 5K, 10K, 50K, 100K, 500K, 1M, 5M.
   - Nút **Lắc Ngay** (bỏ qua đếm ngược), **Gấp Đôi (x2)**, **ALL-IN**, **Hủy Cược**.
   - Nút **Nạp Tiền** (+10,000,000 ₫) bất cứ khi nào cần.
5. **Bảng Soi Cầu (Bead Road)**: Theo dõi cầu bệt, cầu đảo với chấm Đỏ (Tài), Xanh (Xỉu), Vàng (Bão) cùng thống kê % trong 50 ván gần nhất.
6. **Lưu Trữ Tự Động**: Lưu số dư và lịch sử cược vào LocalStorage trình duyệt.

---

## 💻 Cách Khởi Chạy
Trò chơi chạy hoàn toàn trên trình duyệt, không cần cài đặt thư viện phụ thuộc:

### Cách 1: Mở trực tiếp bằng trình duyệt
Mở file `index.html` trực tiếp bằng Chrome, Safari hoặc Edge:
```bash
open /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game/index.html
```

### Cách 2: Khởi chạy qua Local Web Server
```bash
cd /Users/tuanminhz/.gemini/antigravity/scratch/tai-xiu-game
python3 -m http.server 8080
```
Sau đó truy cập: [http://localhost:8080](http://localhost:8080)
