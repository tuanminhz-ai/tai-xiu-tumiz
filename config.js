/* ==========================================================================
   NHÀ CÁI TUMIZ - CẤU HÌNH HỆ THỐNG & ĐỒNG BỘ ĐÁM MÂY (MULTI-DEVICE CLOUD)
   Slogan: Chơi thật hay, thắng liền tay

   HƯỚNG DẪN KẾT NỐI BẠN BÈ & CHƠI ĐA THIẾT BỊ:
   1. Vào https://console.firebase.google.com (miễn phí 100% của Google).
   2. Tạo 1 dự án (Project) mới (VD: "nha-cai-tumiz").
   3. Vào mục "Build" -> "Realtime Database" -> Bấm "Create Database".
   4. Chọn khu vực Singapore (asia-southeast1) hoặc US.
   5. Ở bước Rules (Bảo mật), chọn "Start in test mode" (hoặc đặt rules .read: true, .write: true).
   6. Copy đường link Database (dạng: https://xxx.firebaseio.com hoặc https://xxx.asia-southeast1.firebasedatabase.app).
   7. Dán vào biến FIREBASE_URL bên dưới!
   ========================================================================== */

window.APP_CONFIG = {
  // 🌐 LINK DATABASE DÙNG CHUNG CHO TẤT CẢ THIẾT BỊ
  // Khi bạn bè mở web trên điện thoại, web sẽ tự động kết nối vào link này!
  FIREBASE_URL: "https://nha-cai-tumiz-default-rtdb.asia-southeast1.firebasedatabase.app",

  // 🏦 THÔNG TIN NGÂN HÀNG NHÀ CÁI TUMIZ (Nhận tiền nạp)
  BANK_NAME: "BIDV",
  BANK_STK: "8860252059",
  BANK_OWNER: "NGUYEN THE ANH",

  // 🎲 TỶ LỆ TRẢ THƯỞNG CỐ ĐỊNH
  PAYOUT_TAI: 1.97,       // Cược Tài 1 ăn 1.97
  PAYOUT_XIU: 1.97,       // Cược Xỉu 1 ăn 1.97
  PAYOUT_BAO: 100,        // Cược Bão 1 ăn 100

  // ⚡ CHU KỲ BÍ MẬT CỦA NHÀ CÁI (Chỉ admin tumiz biết trước)
  TRIPLE_CYCLE: 50        // Cứ 50 ván có 1 ván nổ bão
};
