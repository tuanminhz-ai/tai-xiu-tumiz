/* ==========================================================================
   NHÀ CÁI TUMIZ - GAME ENGINE & AUTH & SECRET HOUSE RADAR
   Slogan: Chơi thật hay, thắng liền tay
   Rules:
     - 3 xúc xắc 3D 6 mặt (1 - 6 mỗi con)
     - Tổng điểm >= 11: TÀI (1 ĂN 1.97)
     - Tổng điểm <= 10: XỈU (1 ĂN 1.97)
     - Bão: 3 xúc xắc có số điểm bằng nhau (1 ĂN 100)
     - Cứ 50 lần chơi sẽ có 1 lần bão (bí mật chỉ nhà cái biết)
     - Chữ sau khi mở bát ghi có dấu: "Tài" và "Xỉu"
     - Lắc bát xong đếm ngược 10s: nếu không nặn bát sẽ tự mở, tự qua tay tiếp theo
     - Rút tiền: tạo request (STK + Ngân Hàng + Tên) gửi về Admin để tự chuyển tiền
     - Nạp tiền: chuyển khoản BIDV 8860252059, admin tự tay duyệt & cộng tiền để kiểm soát lạm phát
     - BẢO MẬT NHÀ CÁI: Chỉ tài khoản 'tumiz' mới thấy nút Quản Trị, biết trước kết quả tay tiếp theo và bao lâu nữa nổ bão!
   ========================================================================== */

(function () {
  'use strict';

  // --- MULTI-USER AUTH STATE ---
  const AUTH = {
    currentUser: null,
    users: {}, // { username: { username, password, balance, vip, deposits: [], withdrawals: [], history: [] } }

    load() {
      try {
        const stored = localStorage.getItem('tx_tumiz_auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.users = parsed.users || {};
          this.currentUser = parsed.currentUser || null;
        }
      } catch (e) {
        console.warn('Cannot load auth', e);
      }

      // Default demo regular player account
      if (!this.users['demo'] && Object.keys(this.users).length === 0) {
        this.users['demo'] = {
          username: 'demo',
          password: '123',
          balance: 200000,
          vip: 1,
          firstBetRefundEligible: true,
          hasUsedFirstBetRefund: false,
          deposits: [
            {
              code: 'NAP TX8892',
              amount: 200000,
              bank: 'BIDV',
              stk: '8860252059',
              time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
              status: 'Thành Công'
            }
          ],
          withdrawals: [],
          history: []
        };
      } else if (this.users['demo'] && this.users['demo'].hasUsedFirstBetRefund === undefined) {
        this.users['demo'].firstBetRefundEligible = true;
        this.users['demo'].hasUsedFirstBetRefund = false;
      }

      // Master Admin House Account: tumiz
      if (!this.users['tumiz']) {
        this.users['tumiz'] = {
          username: 'tumiz',
          password: 'tumiz888',
          balance: 50000000,
          vip: 99,
          deposits: [],
          withdrawals: [],
          history: []
        };
      } else if (this.users['tumiz'].password === '123') {
        this.users['tumiz'].password = 'tumiz888';
      }

      if (!this.currentUser || !this.users[this.currentUser]) {
        this.currentUser = 'demo';
      }
    },

    save() {
      try {
        localStorage.setItem('tx_tumiz_auth', JSON.stringify({
          users: this.users,
          currentUser: this.currentUser
        }));
      } catch (e) {}
    },

    getUser() {
      if (!this.currentUser || !this.users[this.currentUser]) {
        return null;
      }
      return this.users[this.currentUser];
    },

    isAdmin() {
      return (this.currentUser === 'tumiz');
    },

    async register(username, password) {
      username = username.trim().toLowerCase();
      if (!username || username.length < 3) {
        return { success: false, message: 'Tên tài khoản phải từ 3 ký tự trở lên!' };
      }
      if (this.users[username]) {
        return { success: false, message: 'Tên tài khoản đã tồn tại! Vui lòng chọn tên khác.' };
      }
      if (!password || password.length < 4) {
        return { success: false, message: 'Mật khẩu phải tối thiểu 4 ký tự!' };
      }

      // Check on cloud if configured
      if (CLOUD_SYNC.isConnected()) {
        try {
          const cloudUser = await CLOUD_SYNC.getUser(username);
          if (cloudUser && cloudUser.username) {
            return { success: false, message: 'Tên tài khoản đã có người đăng ký trên hệ thống!' };
          }
        } catch (e) {}
      }

      // RULE: "sửa lại đoạn đăng ký mới thay vì tặng 100 thì sẽ là hoàn tiền vé cược đầu khi đánh trên 10k, ví dụ đánh 20k thua thì vẫn sẽ được hoàn lại tiền sau đó thì mọi thứ như bình thường"
      this.users[username] = {
        username: username,
        password: password,
        balance: 0, // Không tặng 100k vốn ban đầu
        vip: 1,
        firstBetRefundEligible: true, // Được bảo hiểm hoàn tiền 100% vé cược đầu tiên nếu cược >= 10.000 ₫
        hasUsedFirstBetRefund: false,
        deposits: [],
        withdrawals: [],
        history: [],
        createdAt: Date.now()
      };

      this.currentUser = username;
      this.save();

      // Push to Cloud Sync so Admin immediately sees this user on any device!
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.saveUser(this.users[username]).catch(() => {});
      }

      return { success: true, user: this.users[username] };
    },

    async login(username, password) {
      username = username.trim().toLowerCase();

      // If user not yet in local storage, check cloud
      if (!this.users[username] && CLOUD_SYNC.isConnected()) {
        try {
          const cloudUser = await CLOUD_SYNC.getUser(username);
          if (cloudUser && cloudUser.username) {
            this.users[username] = {
              username: cloudUser.username,
              password: cloudUser.password,
              balance: Number(cloudUser.balance) || 0,
              vip: cloudUser.vip || 1,
              firstBetRefundEligible: cloudUser.firstBetRefundEligible !== undefined ? cloudUser.firstBetRefundEligible : true,
              hasUsedFirstBetRefund: !!cloudUser.hasUsedFirstBetRefund,
              deposits: cloudUser.deposits || [],
              withdrawals: cloudUser.withdrawals || [],
              history: []
            };
            this.save();
          }
        } catch (e) {}
      }

      if (!this.users[username]) {
        return { success: false, message: 'Tài khoản không tồn tại!' };
      }
      if (this.users[username].password !== password) {
        return { success: false, message: 'Mật khẩu không chính xác!' };
      }

      this.currentUser = username;
      this.save();
      return { success: true, user: this.users[username] };
    },

    logout() {
      this.currentUser = null;
      this.save();
    }
  };

  // --- GAME STATE ---
  const STATE = {
    currentChip: 1000,
    nanBatEnabled: true,
    sessionId: 882910,
    roundCounter: 0, // Master counter for the 50-game Triple cycle
    timeLeft: 15,
    timerInterval: null,
    bowlAutoTimerInterval: null,
    nextRoundTimerInterval: null,
    revealTimeLeft: 10,
    isRolling: false,
    isRevealing: false,
    currentDice: [5, 5, 1],
    nextDice: [5, 5, 1], // Pre-determined dice for upcoming round
    adminOverride: null, // 'tai' | 'xiu' | 'triple' | null
    bets: {
      tai: 0,
      xiu: 0,
      triple: 0
    },
    simulatedBets: {
      tai: 18500000,
      xiu: 14200000,
      taiUsers: 189,
      xiuUsers: 142
    },
    globalHistory: [],
    stats: {
      taiCount: 0,
      xiuCount: 0,
      tripleCount: 0,
      totalGames: 0,
      winGames: 0
    },
    pendingDeposit: {
      amount: 200000,
      code: 'NAP TX8892'
    }
  };

  // 3D Cube Base Rotations for Faces 1 to 6
  const BASE_FACE_ROTATIONS = {
    1: { rx: 0,   ry: 0 },
    2: { rx: -90, ry: 0 },
    3: { rx: 0,   ry: -90 },
    4: { rx: 0,   ry: 90 },
    5: { rx: 90,  ry: 0 },
    6: { rx: 0,   ry: 180 }
  };

  const DICE_TILTS = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }
  ];

  let cumulativeSpins = [0, 0, 0];

  // --- DOM ELEMENTS ---
  const el = {
    displayUsername: document.getElementById('displayUsername'),
    displayVip: document.getElementById('displayVip'),
    btnLogout: document.getElementById('btnLogout'),
    btnUserMenu: document.getElementById('btnUserMenu'),
    userBalance: document.getElementById('userBalance'),
    btnOpenDeposit: document.getElementById('btnOpenDeposit'),
    btnOpenWithdraw: document.getElementById('btnOpenWithdraw'),
    btnOpenAdmin: document.getElementById('btnOpenAdmin'),
    btnSound: document.getElementById('soundIcon'),
    soundToggleBtn: document.getElementById('btnSound'),
    btnMode: document.getElementById('btnMode'),
    modeText: document.getElementById('modeText'),
    sessionId: document.getElementById('sessionId'),
    timerNumber: document.getElementById('timerNumber'),
    timerProgress: document.getElementById('timerProgress'),
    timerLabel: document.getElementById('timerLabel'),
    gameStatus: document.getElementById('gameStatus'),

    // Dice & Shaker arena
    dishPlate: document.getElementById('dishPlate'),
    dice1: document.getElementById('dice1'),
    dice2: document.getElementById('dice2'),
    dice3: document.getElementById('dice3'),
    bowlOverlay: document.getElementById('bowlOverlay'),
    bowlHint: document.getElementById('bowlHint'),
    bowlAutoTimer: document.getElementById('bowlAutoTimer'),
    bowlTimerNum: document.getElementById('bowlTimerNum'),
    bowlControls: document.getElementById('bowlControls'),
    btnQuickOpen: document.getElementById('btnQuickOpen'),
    resultBanner: document.getElementById('resultBanner'),
    scoreBreakdown: document.getElementById('scoreBreakdown'),
    totalScore: document.getElementById('totalScore'),
    winnerTitle: document.getElementById('winnerTitle'),

    // Bet spots
    spotTai: document.getElementById('spotTai'),
    spotXiu: document.getElementById('spotXiu'),
    spotTriple: document.getElementById('spotTriple'),
    totalBetTai: document.getElementById('totalBetTai'),
    totalBetXiu: document.getElementById('totalBetXiu'),
    userCountTai: document.getElementById('userCountTai'),
    userCountXiu: document.getElementById('userCountXiu'),
    myBetTaiVal: document.getElementById('myBetTaiVal'),
    myBetXiuVal: document.getElementById('myBetXiuVal'),
    myBetTripleVal: document.getElementById('myBetTripleVal'),

    // Control buttons
    btnDouble: document.getElementById('btnDouble'),
    btnAllIn: document.getElementById('btnAllIn'),
    btnClearBet: document.getElementById('btnClearBet'),
    chips: document.querySelectorAll('.chip'),
    betSpots: document.querySelectorAll('.bet-spot'),

    // Soi Cau & History
    beadRoad: document.getElementById('beadRoad'),
    statTaiCount: document.getElementById('statTaiCount'),
    statTaiPct: document.getElementById('statTaiPct'),
    statXiuCount: document.getElementById('statXiuCount'),
    statXiuPct: document.getElementById('statXiuPct'),
    statTripleCount: document.getElementById('statTripleCount'),
    roadTrendBadge: document.getElementById('roadTrendBadge'),
    ratioTaiText: document.getElementById('ratioTaiText'),
    ratioXiuText: document.getElementById('ratioXiuText'),
    ratioFillTai: document.getElementById('ratioFillTai'),
    ratioFillXiu: document.getElementById('ratioFillXiu'),
    ratioTotalRounds: document.getElementById('ratioTotalRounds'),
    recentStreamPills: document.getElementById('recentStreamPills'),
    historyBody: document.getElementById('historyBody'),
    winRateBadge: document.getElementById('winRateBadge'),

    // Toast & Win Modal & First Bet Refund Modal
    toast: document.getElementById('toast'),
    winModal: document.getElementById('winModal'),
    winModalTitle: document.getElementById('winModalTitle'),
    winModalAmount: document.getElementById('winModalAmount'),
    winModalDetail: document.getElementById('winModalDetail'),
    btnCloseWinModal: document.getElementById('btnCloseWinModal'),
    firstBetRefundModal: document.getElementById('firstBetRefundModal'),
    btnCloseRefundModal: document.getElementById('btnCloseRefundModal'),
    refundModalAmount: document.getElementById('refundModalAmount'),
    refundBetAmountText: document.getElementById('refundBetAmountText'),

    // 8XBET Sponsor Modal
    ad8xbetModal: document.getElementById('ad8xbetModal'),
    btnClose8xbetAd: document.getElementById('btnClose8xbetAd'),
    btnOpen8xbetAd: document.getElementById('btnOpen8xbetAd'),
    ad8xbetBackdrop: document.getElementById('ad8xbetBackdrop'),
    btnJoin8xbet: document.getElementById('btnJoin8xbet'),
    btnDismiss8xbet: document.getElementById('btnDismiss8xbet'),
    btnQuickTestDeposit: document.getElementById('btnQuickTestDeposit'),

    // Auth Modal
    authModal: document.getElementById('authModal'),
    btnCloseAuth: document.getElementById('btnCloseAuth'),
    tabBtnLogin: document.getElementById('tabBtnLogin'),
    tabBtnRegister: document.getElementById('tabBtnRegister'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    regUsername: document.getElementById('regUsername'),
    regPassword: document.getElementById('regPassword'),
    regPasswordConfirm: document.getElementById('regPasswordConfirm'),
    btnQuickGuest: document.getElementById('btnQuickGuest'),

    // Admin PIN Modal
    adminPinModal: document.getElementById('adminPinModal'),
    adminPinBackdrop: document.getElementById('adminPinBackdrop'),
    btnCloseAdminPin: document.getElementById('btnCloseAdminPin'),
    adminPinForm: document.getElementById('adminPinForm'),
    adminPinInput: document.getElementById('adminPinInput'),

    // Deposit Modal
    depositModal: document.getElementById('depositModal'),
    btnCloseDeposit: document.getElementById('btnCloseDeposit'),
    tabBtnCreateDep: document.getElementById('tabBtnCreateDep'),
    tabBtnDepHistory: document.getElementById('tabBtnDepHistory'),
    depContentCreate: document.getElementById('depContentCreate'),
    depContentHistory: document.getElementById('depContentHistory'),
    depositStep1: document.getElementById('depositStep1'),
    depositStep2: document.getElementById('depositStep2'),
    customAmount: document.getElementById('customAmount'),
    btnGenerateBill: document.getElementById('btnGenerateBill'),
    vietQrImg: document.getElementById('vietQrImg'),
    stkDisplay: document.getElementById('stkDisplay'),
    billAmountDisplay: document.getElementById('billAmountDisplay'),
    billMemoDisplay: document.getElementById('billMemoDisplay'),
    btnConfirmTransfer: document.getElementById('btnConfirmTransfer'),
    btnBackStep1: document.getElementById('btnBackStep1'),
    depositHistoryBody: document.getElementById('depositHistoryBody'),

    // Withdraw Modal
    withdrawModal: document.getElementById('withdrawModal'),
    btnCloseWithdraw: document.getElementById('btnCloseWithdraw'),
    tabBtnCreateWithdraw: document.getElementById('tabBtnCreateWithdraw'),
    tabBtnWithdrawHistory: document.getElementById('tabBtnWithdrawHistory'),
    withdrawContentCreate: document.getElementById('withdrawContentCreate'),
    withdrawContentHistory: document.getElementById('withdrawContentHistory'),
    withdrawAvailBalance: document.getElementById('withdrawAvailBalance'),
    withdrawForm: document.getElementById('withdrawForm'),
    withdrawBank: document.getElementById('withdrawBank'),
    withdrawStk: document.getElementById('withdrawStk'),
    withdrawName: document.getElementById('withdrawName'),
    withdrawAmount: document.getElementById('withdrawAmount'),
    btnWithdrawAll: document.getElementById('btnWithdrawAll'),
    withdrawHistoryBody: document.getElementById('withdrawHistoryBody'),

    // Admin Dashboard Modal & Secret House Radar
    adminModal: document.getElementById('adminModal'),
    btnCloseAdmin: document.getElementById('btnCloseAdmin'),
    adminTotalUsers: document.getElementById('adminTotalUsers'),
    adminTotalMoney: document.getElementById('adminTotalMoney'),
    adminPendingDepCount: document.getElementById('adminPendingDepCount'),
    adminPendingWithdrawCount: document.getElementById('adminPendingWithdrawCount'),
    badgePendingDep: document.getElementById('badgePendingDep'),
    badgePendingWithdraw: document.getElementById('badgePendingWithdraw'),
    adminTripleCountdown: document.getElementById('adminTripleCountdown'),
    adminNextDiceVal: document.getElementById('adminNextDiceVal'),
    adminNextResultBadge: document.getElementById('adminNextResultBadge'),
    btnOverrideTai: document.getElementById('btnOverrideTai'),
    btnOverrideXiu: document.getElementById('btnOverrideXiu'),
    btnOverrideTriple: document.getElementById('btnOverrideTriple'),
    btnOverrideAuto: document.getElementById('btnOverrideAuto'),
    tabBtnAdminDep: document.getElementById('tabBtnAdminDep'),
    tabBtnAdminWithdraw: document.getElementById('tabBtnAdminWithdraw'),
    tabBtnAdminUsers: document.getElementById('tabBtnAdminUsers'),
    tabBtnAdminInflate: document.getElementById('tabBtnAdminInflate'),
    tabBtnAdminSecurity: document.getElementById('tabBtnAdminSecurity'),
    tabBtnAdminCloud: document.getElementById('tabBtnAdminCloud'),
    adminContentDep: document.getElementById('adminContentDep'),
    adminContentWithdraw: document.getElementById('adminContentWithdraw'),
    adminContentUsers: document.getElementById('adminContentUsers'),
    adminContentInflate: document.getElementById('adminContentInflate'),
    adminContentSecurity: document.getElementById('adminContentSecurity'),
    adminContentCloud: document.getElementById('adminContentCloud'),
    adminDepListBody: document.getElementById('adminDepListBody'),
    adminWithdrawListBody: document.getElementById('adminWithdrawListBody'),
    adminUserListBody: document.getElementById('adminUserListBody'),
    btnRefreshDep: document.getElementById('btnRefreshDep'),
    btnRefreshWithdraw: document.getElementById('btnRefreshWithdraw'),
    btnRefreshUsers: document.getElementById('btnRefreshUsers'),
    badgeTotalUsers: document.getElementById('badgeTotalUsers'),
    inflateUserSelect: document.getElementById('inflateUserSelect'),
    inflateAmount: document.getElementById('inflateAmount'),
    btnInflateAdd: document.getElementById('btnInflateAdd'),
    btnInflateSub: document.getElementById('btnInflateSub'),

    // Security & Cloud Sync
    adminChangePwdForm: document.getElementById('adminChangePwdForm'),
    oldAdminPwd: document.getElementById('oldAdminPwd'),
    newAdminPwd: document.getElementById('newAdminPwd'),
    newAdminPwdConfirm: document.getElementById('newAdminPwdConfirm'),
    cloudDbUrl: document.getElementById('cloudDbUrl'),
    btnSaveCloudDb: document.getElementById('btnSaveCloudDb'),
    btnTestCloudSync: document.getElementById('btnTestCloudSync'),
    btnForceSyncCloud: document.getElementById('btnForceSyncCloud'),
    cloudStatusBadge: document.getElementById('cloudStatusBadge'),

    // Admin Live Bets Radar
    adminLiveSessionId: document.getElementById('adminLiveSessionId'),
    adminLiveTimerText: document.getElementById('adminLiveTimerText'),
    adminLiveTaiTotal: document.getElementById('adminLiveTaiTotal'),
    adminLiveXiuTotal: document.getElementById('adminLiveXiuTotal'),
    adminLiveBaoTotal: document.getElementById('adminLiveBaoTotal'),
    adminLiveTaiList: document.getElementById('adminLiveTaiList'),
    adminLiveXiuList: document.getElementById('adminLiveXiuList'),
    adminLiveBaoList: document.getElementById('adminLiveBaoList'),
    adminPnlTai: document.getElementById('adminPnlTai'),
    adminPnlXiu: document.getElementById('adminPnlXiu'),
    adminPnlBao: document.getElementById('adminPnlBao'),
    pnlCardTai: document.getElementById('pnlCardTai'),
    pnlCardXiu: document.getElementById('pnlCardXiu'),
    pnlCardBao: document.getElementById('pnlCardBao'),
    adminSmartAdvice: document.getElementById('adminSmartAdvice')
  };

  function seedInitialGlobalHistory() {
    if (STATE.globalHistory && STATE.globalHistory.length >= 30) return;
    const initialList = [];
    const baseId = STATE.sessionId - 40;
    for (let i = 0; i < 40; i++) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2 + d3;
      const isTriple = (d1 === d2 && d2 === d3);
      const isTai = (total >= 11);
      initialList.unshift({
        id: baseId + i,
        dice: [d1, d2, d3],
        total,
        winner: isTriple ? 'Bão' : (isTai ? 'Tài' : 'Xỉu'),
        isTriple,
        time: Date.now() - (40 - i) * 20000
      });
    }
    STATE.globalHistory = initialList;
  }

  // --- STORAGE LOAD ---
  function loadPersistedData() {
    try {
      const savedCount = localStorage.getItem('tx_tumiz_round_counter');
      if (savedCount !== null) {
        STATE.roundCounter = parseInt(savedCount, 10) || 0;
      }
      const savedHist = localStorage.getItem('tx_tumiz_global_hist');
      if (savedHist) {
        STATE.globalHistory = JSON.parse(savedHist);
      }
      seedInitialGlobalHistory();
    } catch (e) {}
  }

  function savePersistedData() {
    try {
      localStorage.setItem('tx_tumiz_round_counter', STATE.roundCounter);
      localStorage.setItem('tx_tumiz_global_hist', JSON.stringify(STATE.globalHistory.slice(0, 50)));
    } catch (e) {}
  }

  // --- CLOUD SYNC ENGINE (ĐỒNG BỘ ĐA THIẾT BỊ REALTIME) ---
  const CLOUD_SYNC = {
    getDbUrl() {
      const customUrl = (localStorage.getItem('tx_cloud_db_url') || '').trim();
      if (customUrl && !customUrl.includes('nha-cai-tumiz-888-default-rtdb')) {
        return customUrl.replace(/\/+$/, '');
      }
      if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.FIREBASE_URL) {
        return (window.APP_CONFIG.FIREBASE_URL || '').trim().replace(/\/+$/, '');
      }
      return '';
    },

    isConnected() {
      return !!this.getDbUrl();
    },

    // --- USER MANAGEMENT (ĐỒNG BỘ TÀI KHOẢN NGƯỜI CHƠI) ---
    async saveUser(user) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !user || !user.username) return false;
      try {
        const cleanUname = encodeURIComponent(user.username.trim().toLowerCase());
        const payload = {
          username: user.username,
          password: user.password,
          balance: Number(user.balance) || 0,
          vip: user.vip || 1,
          firstBetRefundEligible: !!user.firstBetRefundEligible,
          hasUsedFirstBetRefund: !!user.hasUsedFirstBetRefund,
          createdAt: user.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        await fetch(`${dbUrl}/users/${cleanUname}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return true;
      } catch (e) {
        console.warn('[CloudSync] saveUser error:', e);
        return false;
      }
    },

    async getUser(username) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !username) return null;
      try {
        const cleanUname = encodeURIComponent(username.trim().toLowerCase());
        const res = await fetch(`${dbUrl}/users/${cleanUname}.json`);
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (e) {
        console.warn('[CloudSync] getUser error:', e);
      }
      return null;
    },

    async fetchUsers() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return {};
      try {
        const res = await fetch(`${dbUrl}/users.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            return data;
          }
        }
      } catch (e) {
        console.warn('[CloudSync] fetchUsers error:', e);
      }
      return {};
    },

    async updateUserBalance(username, newBalance) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !username) return false;
      try {
        const cleanUname = encodeURIComponent(username.trim().toLowerCase());
        await fetch(`${dbUrl}/users/${cleanUname}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            balance: Number(newBalance),
            updatedAt: Date.now()
          })
        });
        return true;
      } catch (e) {
        console.warn('[CloudSync] updateUserBalance error:', e);
        return false;
      }
    },

    // --- DEPOSIT REQUESTS (ĐỒNG BỘ LỆNH NẠP TIỀN) ---
    async pushDeposit(dep) {
      const dbUrl = this.getDbUrl();
      const payload = {
        code: dep.code,
        username: dep.username,
        amount: Number(dep.amount) || 0,
        bank: dep.bank || 'BIDV',
        stk: dep.stk || '8860252059',
        time: dep.time || new Date().toLocaleString('vi-VN'),
        status: dep.status || 'Chờ Duyệt',
        createdAt: dep.createdAt || Date.now()
      };

      if (dbUrl) {
        try {
          const key = dep.code.replace(/[^a-zA-Z0-9_-]/g, '_');
          await fetch(`${dbUrl}/deposits/${key}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          console.log('[CloudSync] Pushed deposit to Firebase successfully');
          return true;
        } catch (e) {
          console.warn('[CloudSync] Firebase push error:', e);
        }
      }

      // Fallback bridge
      try {
        const cleanCode = dep.code.replace(/[^a-zA-Z0-9_-]/g, '_');
        await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/dep_${cleanCode}`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (e) {}

      return true;
    },

    async fetchCloudDeposits() {
      const dbUrl = this.getDbUrl();
      const list = [];

      if (dbUrl) {
        try {
          const res = await fetch(`${dbUrl}/deposits.json`);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              Object.keys(data).forEach(k => {
                if (data[k]) {
                  list.push({ ...data[k], cloudKey: k, cloudSource: 'firebase' });
                }
              });
            }
          }
        } catch (e) {
          console.warn('[CloudSync] Firebase fetch error:', e);
        }
      }

      // Fallback bridge
      try {
        const res = await fetch('https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/?prefix=dep_');
        if (res.ok) {
          const keys = await res.json();
          for (const k of (keys || []).slice(0, 15)) {
            const itemRes = await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/${k}`);
            if (itemRes.ok) {
              const item = await itemRes.json();
              if (item && item.code && !list.some(r => r.code === item.code)) {
                list.push({ ...item, cloudKey: k, cloudSource: 'kvdb' });
              }
            }
          }
        }
      } catch (e) {}

      return list;
    },

    async updateCloudDepositStatus(cloudKey, cloudSource, code, newStatus) {
      const dbUrl = this.getDbUrl();
      if (dbUrl) {
        try {
          const key = (cloudKey || code).replace(/[^a-zA-Z0-9_-]/g, '_');
          await fetch(`${dbUrl}/deposits/${key}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: newStatus,
              processedAt: Date.now()
            })
          });
        } catch (e) {}
      }

      try {
        const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
        await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/dep_${cleanCode}`, {
          method: 'POST',
          body: JSON.stringify({ code, status: newStatus })
        });
      } catch (e) {}
    },

    // --- WITHDRAWAL REQUESTS (ĐỒNG BỘ LỆNH RÚT TIỀN) ---
    async pushWithdrawal(withd) {
      const dbUrl = this.getDbUrl();
      const payload = {
        code: withd.code,
        username: withd.username,
        amount: Number(withd.amount) || 0,
        bank: withd.bank,
        stk: withd.stk,
        name: withd.name,
        time: withd.time || new Date().toLocaleString('vi-VN'),
        status: withd.status || 'Chờ Admin Chuyển Tiền',
        createdAt: withd.createdAt || Date.now()
      };

      if (dbUrl) {
        try {
          const key = withd.code.replace(/[^a-zA-Z0-9_-]/g, '_');
          await fetch(`${dbUrl}/withdrawals/${key}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          console.log('[CloudSync] Pushed withdrawal to Firebase successfully');
          return true;
        } catch (e) {
          console.warn('[CloudSync] pushWithdrawal error:', e);
        }
      }

      // Fallback bridge
      try {
        const cleanCode = withd.code.replace(/[^a-zA-Z0-9_-]/g, '_');
        await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/with_${cleanCode}`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (e) {}

      return true;
    },

    async fetchCloudWithdrawals() {
      const dbUrl = this.getDbUrl();
      const list = [];

      if (dbUrl) {
        try {
          const res = await fetch(`${dbUrl}/withdrawals.json`);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              Object.keys(data).forEach(k => {
                if (data[k]) {
                  list.push({ ...data[k], cloudKey: k, cloudSource: 'firebase' });
                }
              });
            }
          }
        } catch (e) {
          console.warn('[CloudSync] Firebase fetch withdrawals error:', e);
        }
      }

      // Fallback bridge
      try {
        const res = await fetch('https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/?prefix=with_');
        if (res.ok) {
          const keys = await res.json();
          for (const k of (keys || []).slice(0, 15)) {
            const itemRes = await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/${k}`);
            if (itemRes.ok) {
              const item = await itemRes.json();
              if (item && item.code && !list.some(r => r.code === item.code)) {
                list.push({ ...item, cloudKey: k, cloudSource: 'kvdb' });
              }
            }
          }
        }
      } catch (e) {}

      return list;
    },

    async updateCloudWithdrawalStatus(cloudKey, cloudSource, code, newStatus) {
      const dbUrl = this.getDbUrl();
      if (dbUrl) {
        try {
          const key = (cloudKey || code).replace(/[^a-zA-Z0-9_-]/g, '_');
          await fetch(`${dbUrl}/withdrawals/${key}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: newStatus,
              processedAt: Date.now()
            })
          });
        } catch (e) {}
      }

      try {
        const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
        await fetch(`https://kvdb.io/S3VzL3mY69eYv8Gv9Uj7jZ/with_${cleanCode}`, {
          method: 'POST',
          body: JSON.stringify({ code, status: newStatus })
        });
      } catch (e) {}
    },

    // --- ACTIVE BETS RADAR (THEO DÕI CƯỢC NGƯỜI CHƠI REALTIME) ---
    async pushActiveBet(bet) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !bet || !bet.username) return;
      try {
        const uname = encodeURIComponent(bet.username);
        await fetch(`${dbUrl}/current_bets/${uname}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bet)
        });
      } catch (e) {}
    },

    async removeActiveBet(username) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !username) return;
      try {
        const uname = encodeURIComponent(username);
        await fetch(`${dbUrl}/current_bets/${uname}.json`, {
          method: 'DELETE'
        });
      } catch (e) {}
    },

    async fetchActiveBets() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return {};
      try {
        const res = await fetch(`${dbUrl}/current_bets.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') return data;
        }
      } catch (e) {}
      return {};
    },

    async clearAllActiveBets() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return;
      try {
        await fetch(`${dbUrl}/current_bets.json`, {
          method: 'DELETE'
        });
      } catch (e) {}
    },

    // --- REALTIME GLOBAL HISTORY ---
    async pushGlobalHistory(round) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl || !round) return;
      try {
        await fetch(`${dbUrl}/recent_history/${round.id}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(round)
        });
      } catch (e) {}
    },

    async fetchGlobalHistory() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return [];
      try {
        const res = await fetch(`${dbUrl}/recent_history.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            return Object.values(data).sort((a, b) => a.id - b.id);
          }
        }
      } catch (e) {}
      return [];
    },

    // --- REALTIME ADMIN GAME CONTROL / OUTCOME INTERVENTION ---
    async setCloudOverride(overrideType, dice) {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return;
      try {
        await fetch(`${dbUrl}/game_control.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminOverride: overrideType,
            forcedDice: dice,
            updatedAt: Date.now()
          })
        });
      } catch (e) {}
    },

    async fetchCloudOverride() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return null;
      try {
        const res = await fetch(`${dbUrl}/game_control.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.updatedAt && (Date.now() - data.updatedAt < 60000)) {
            return data;
          }
        }
      } catch (e) {}
      return null;
    },

    async clearCloudOverride() {
      const dbUrl = this.getDbUrl();
      if (!dbUrl) return;
      try {
        await fetch(`${dbUrl}/game_control.json`, {
          method: 'DELETE'
        });
      } catch (e) {}
    }
  };

  // --- FORMATTING HELPERS ---
  function formatMoney(num) {
    return Number(num).toLocaleString('vi-VN');
  }

  function showToast(msg, duration = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, duration);
  }

  // --- SECRET HOUSE RADAR & PRE-DETERMINED OUTCOMES ---
  // Calculates in advance what the next dice will be and how many rounds until Bão!
  function calculateNextRoundDice() {
    // Current index in 50-round cycle: 1 to 50
    const nextGameNumber = STATE.roundCounter + 1;
    const currentInCycle = ((nextGameNumber - 1) % 50) + 1;
    const remainingUntilTriple = 50 - currentInCycle;

    let d1, d2, d3;

    // Check if forced Bão (by cycle 50 or admin override)
    if (STATE.adminOverride === 'triple' || currentInCycle === 50) {
      const tripVal = Math.floor(Math.random() * 6) + 1;
      d1 = tripVal;
      d2 = tripVal;
      d3 = tripVal;
    } else if (STATE.adminOverride === 'tai') {
      // Force Tài (>= 11) without triple
      do {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
        d3 = Math.floor(Math.random() * 6) + 1;
      } while (d1 + d2 + d3 < 11 || (d1 === d2 && d2 === d3));
    } else if (STATE.adminOverride === 'xiu') {
      // Force Xỉu (<= 10) without triple
      do {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
        d3 = Math.floor(Math.random() * 6) + 1;
      } while (d1 + d2 + d3 > 10 || (d1 === d2 && d2 === d3));
    } else {
      // Natural random dice, strictly preventing accidental triple before the 50th round
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = Math.floor(Math.random() * 6) + 1;
      d3 = Math.floor(Math.random() * 6) + 1;
      if (d1 === d2 && d2 === d3) {
        d3 = (d3 % 6) + 1;
      }
    }

    STATE.nextDice = [d1, d2, d3];
    updateHouseRadarUI(remainingUntilTriple, currentInCycle);
  }

  function updateHouseRadarUI(remainingUntilTriple, currentInCycle) {
    if (!el.adminNextDiceVal) return;

    const [d1, d2, d3] = STATE.nextDice;
    const total = d1 + d2 + d3;
    const isTriple = (d1 === d2 && d2 === d3);
    const isTai = (total >= 11);

    let winnerStr = isTai ? 'TÀI' : 'XỈU';
    if (isTriple) winnerStr = `BÃO ${d1} (${winnerStr})`;

    el.adminNextDiceVal.textContent = `🎲 [ ${d1} - ${d2} - ${d3} ] = ${total} điểm`;
    el.adminNextResultBadge.textContent = winnerStr;
    el.adminNextResultBadge.className = `pred-result-badge ${isTriple ? 'bão' : (isTai ? 'tài' : 'xỉu')}`;

    if (remainingUntilTriple === 0 || STATE.adminOverride === 'triple') {
      el.adminTripleCountdown.textContent = `⚡ TAY NÀY SẼ NỔ BÃO! (Ván 50/50)`;
      el.adminTripleCountdown.style.background = 'rgba(239, 68, 68, 0.25)';
      el.adminTripleCountdown.style.color = '#fca5a5';
    } else {
      el.adminTripleCountdown.textContent = `⚡ Còn ${remainingUntilTriple} ván nữa nổ BÃO (Ván ${currentInCycle}/50)`;
      el.adminTripleCountdown.style.background = '';
      el.adminTripleCountdown.style.color = '';
    }

    // Update active override buttons
    if (el.btnOverrideTai) {
      el.btnOverrideTai.classList.toggle('active', STATE.adminOverride === 'tai');
      el.btnOverrideXiu.classList.toggle('active', STATE.adminOverride === 'xiu');
      el.btnOverrideTriple.classList.toggle('active', STATE.adminOverride === 'triple');
      el.btnOverrideAuto.classList.toggle('active', STATE.adminOverride === null);
    }
  }

  // --- USER PROFILE & ROLE VISIBILITY ---
  function updateAuthHeaderUI() {
    const user = AUTH.getUser();
    if (user) {
      el.displayUsername.textContent = user.username;
      el.displayVip.textContent = (user.username === 'tumiz') ? 'NHÀ CÁI' : `VIP ${user.vip || 1}`;
      el.userBalance.textContent = formatMoney(user.balance);
      el.btnLogout.style.display = 'block';

      // Only the house account 'tumiz' can see the Admin Panel button!
      if (AUTH.isAdmin()) {
        el.btnOpenAdmin.classList.remove('hidden');
      } else {
        el.btnOpenAdmin.classList.add('hidden');
      }
    } else {
      el.displayUsername.textContent = 'Chưa Đăng Nhập';
      el.displayVip.textContent = 'GUEST';
      el.userBalance.textContent = '0';
      el.btnLogout.style.display = 'none';
      el.btnOpenAdmin.classList.add('hidden');
    }
  }

  function updateBetDisplays() {
    el.myBetTaiVal.textContent = formatMoney(STATE.bets.tai) + ' ₫';
    el.myBetXiuVal.textContent = formatMoney(STATE.bets.xiu) + ' ₫';
    el.myBetTripleVal.textContent = formatMoney(STATE.bets.triple) + ' ₫';

    el.totalBetTai.textContent = formatMoney(STATE.simulatedBets.tai + STATE.bets.tai) + ' ₫';
    el.totalBetXiu.textContent = formatMoney(STATE.simulatedBets.xiu + STATE.bets.xiu) + ' ₫';
    el.userCountTai.textContent = STATE.simulatedBets.taiUsers + (STATE.bets.tai > 0 ? 1 : 0);
    el.userCountXiu.textContent = STATE.simulatedBets.xiuUsers + (STATE.bets.xiu > 0 ? 1 : 0);

    // RULE: "chỉ được cược 1 trong 3 loại, đã cược tài r thì không được cược xỉu, đã cược xỉu rồi thì không được cược tài và tương tự cho bão"
    const hasTai = (STATE.bets.tai > 0);
    const hasXiu = (STATE.bets.xiu > 0);
    const hasTriple = (STATE.bets.triple > 0);

    if (el.spotTai) {
      el.spotTai.classList.toggle('locked-spot', hasXiu || hasTriple);
      el.spotTai.classList.toggle('active-chosen-spot', hasTai);
    }
    if (el.spotXiu) {
      el.spotXiu.classList.toggle('locked-spot', hasTai || hasTriple);
      el.spotXiu.classList.toggle('active-chosen-spot', hasXiu);
    }
    if (el.spotTriple) {
      el.spotTriple.classList.toggle('locked-spot', hasTai || hasXiu);
      el.spotTriple.classList.toggle('active-chosen-spot', hasTriple);
    }

    syncCurrentActiveBetToCloud();
  }

  function syncCurrentActiveBetToCloud() {
    const user = AUTH.getUser();
    if (!user || !CLOUD_SYNC.isConnected()) return;

    let activeType = null;
    let activeAmt = 0;
    if (STATE.bets.tai > 0) { activeType = 'tai'; activeAmt = STATE.bets.tai; }
    else if (STATE.bets.xiu > 0) { activeType = 'xiu'; activeAmt = STATE.bets.xiu; }
    else if (STATE.bets.triple > 0) { activeType = 'triple'; activeAmt = STATE.bets.triple; }

    if (activeType && activeAmt > 0) {
      CLOUD_SYNC.pushActiveBet({
        username: user.username,
        betType: activeType,
        amount: activeAmt,
        sessionId: STATE.sessionId,
        updatedAt: Date.now()
      });
    } else {
      CLOUD_SYNC.removeActiveBet(user.username);
    }
  }

  // --- 3D 6-FACE DICE ENGINE ---
  function position3DDice(diceIndex, faceValue) {
    const diceEl = el[`dice${diceIndex}`];
    const base = BASE_FACE_ROTATIONS[faceValue] || { rx: 0, ry: 0 };
    const tilt = DICE_TILTS[diceIndex - 1];

    cumulativeSpins[diceIndex - 1] += 360 * (3 + Math.floor(Math.random() * 2));
    const spin = cumulativeSpins[diceIndex - 1];

    const finalX = spin + base.rx + tilt.x;
    const finalY = spin + base.ry + tilt.y;
    const finalZ = tilt.z;

    diceEl.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg) rotateZ(${finalZ}deg)`;
  }

  // --- BETTING HANDLERS ---
  function placeBet(type) {
    const user = AUTH.getUser();
    if (!user) {
      showToast('Vui lòng đăng nhập để đặt cược!');
      openAuthModal('login');
      return;
    }

    if (STATE.isRolling || STATE.isRevealing) {
      showToast('Đang lắc hoặc mở bát, vui lòng chờ phiên sau!');
      return;
    }

    // RULE: "sửa luôn cả luật, chỉ được cược 1 trong 3 loại, đã cược tài r thì không được cược xỉu, đã cược xỉu rồi thì không được cược tài và tương tự cho bão"
    if (type === 'tai') {
      if (STATE.bets.xiu > 0) {
        showToast('⚠️ Bạn đã cược XỈU rồi, không thể cược thêm TÀI! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
      if (STATE.bets.triple > 0) {
        showToast('⚠️ Bạn đã cược BÃO rồi, không thể cược thêm TÀI! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
    } else if (type === 'xiu') {
      if (STATE.bets.tai > 0) {
        showToast('⚠️ Bạn đã cược TÀI rồi, không thể cược thêm XỈU! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
      if (STATE.bets.triple > 0) {
        showToast('⚠️ Bạn đã cược BÃO rồi, không thể cược thêm XỈU! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
    } else if (type === 'triple') {
      if (STATE.bets.tai > 0) {
        showToast('⚠️ Bạn đã cược TÀI rồi, không thể cược thêm BÃO! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
      if (STATE.bets.xiu > 0) {
        showToast('⚠️ Bạn đã cược XỈU rồi, không thể cược thêm BÃO! (Bấm HỦY CƯỢC nếu muốn đổi cửa)');
        window.soundEngine.playLoss();
        return;
      }
    } else {
      showToast('⚠️ Chỉ được cược 1 trong 3 loại: TÀI, XỈU hoặc BÃO!');
      return;
    }

    if (user.balance < STATE.currentChip) {
      showToast('Số dư không đủ! Bấm Nạp Tiền BIDV để nạp thêm.');
      window.soundEngine.playLoss();
      return;
    }

    user.balance -= STATE.currentChip;
    STATE.bets[type] += STATE.currentChip;

    AUTH.save();
    window.soundEngine.playChip();
    updateAuthHeaderUI();
    updateBetDisplays();
  }

  function clearAllBets() {
    const user = AUTH.getUser();
    if (!user) return;

    if (STATE.isRolling || STATE.isRevealing) {
      showToast('Không thể hủy cược khi đang lắc!');
      return;
    }

    let refund = 0;
    Object.keys(STATE.bets).forEach(key => {
      refund += STATE.bets[key];
      STATE.bets[key] = 0;
    });

    if (refund > 0) {
      user.balance += refund;
      AUTH.save();
      updateAuthHeaderUI();
      updateBetDisplays();
      showToast(`Đã hoàn trả ${formatMoney(refund)} ₫`);
      window.soundEngine.playChip();
    }
  }

  function doubleBets() {
    const user = AUTH.getUser();
    if (!user || STATE.isRolling || STATE.isRevealing) return;

    let totalNeeded = 0;
    Object.keys(STATE.bets).forEach(key => totalNeeded += STATE.bets[key]);

    if (totalNeeded === 0) {
      showToast('Chưa có cược để nhân đôi!');
      return;
    }

    if (user.balance < totalNeeded) {
      showToast('Không đủ số dư để gấp đôi cược!');
      return;
    }

    user.balance -= totalNeeded;
    Object.keys(STATE.bets).forEach(key => STATE.bets[key] *= 2);

    AUTH.save();
    window.soundEngine.playChip();
    updateAuthHeaderUI();
    updateBetDisplays();
    showToast('Đã gấp đôi cược!');
  }

  function allInBet() {
    const user = AUTH.getUser();
    if (!user || STATE.isRolling || STATE.isRevealing) return;
    if (user.balance <= 0) {
      showToast('Số dư đã hết! Vui lòng nạp tiền.');
      return;
    }

    let target = null;
    if (STATE.bets.tai > 0) target = 'tai';
    else if (STATE.bets.xiu > 0) target = 'xiu';
    else if (STATE.bets.triple > 0) target = 'triple';

    if (!target) {
      showToast('👉 Vui lòng nhấp vào cửa muốn cược (TÀI, XỈU hoặc BÃO) trước khi ALL-IN!');
      return;
    }

    const amount = user.balance;
    STATE.bets[target] += amount;
    user.balance = 0;

    AUTH.save();
    window.soundEngine.playChip();
    updateAuthHeaderUI();
    updateBetDisplays();
    const targetName = target === 'tai' ? 'TÀI' : (target === 'xiu' ? 'XỈU' : 'BÃO');
    showToast(`🔥 ĐÃ ALL-IN ${formatMoney(amount)} ₫ vào ${targetName}!`);
  }

  // --- SESSION & ROLLING ENGINE ---
  function startSessionTimer() {
    clearInterval(STATE.timerInterval);
    clearInterval(STATE.bowlAutoTimerInterval);
    if (STATE.nextRoundTimerInterval) {
      clearInterval(STATE.nextRoundTimerInterval);
      STATE.nextRoundTimerInterval = null;
    }
    STATE.isRolling = false;
    STATE.isRevealing = false;
    isDraggingBowl = false;
    currentX = 0;
    currentY = 0;
    STATE.timeLeft = 15;
    el.timerLabel.textContent = 'ĐẶT CƯỢC';
    el.gameStatus.textContent = 'Nhà Cái Tumiz đang nhận cược...';
    el.gameStatus.className = 'status-badge';
    el.resultBanner.classList.remove('show');

    // Pre-determine next dice so the House knows in advance!
    calculateNextRoundDice();

    // Simulate crowd betting
    STATE.simulatedBets.tai = Math.floor(12000000 + Math.random() * 18000000);
    STATE.simulatedBets.xiu = Math.floor(10000000 + Math.random() * 16000000);
    STATE.simulatedBets.taiUsers = Math.floor(120 + Math.random() * 150);
    STATE.simulatedBets.xiuUsers = Math.floor(100 + Math.random() * 130);
    updateBetDisplays();

    // Reset bowl overlay
    el.bowlOverlay.classList.remove('active');
    el.bowlOverlay.style.transform = 'translate(0px, 0px)';
    el.btnQuickOpen.style.display = 'none';

    updateTimerDisplay();

    STATE.timerInterval = setInterval(() => {
      STATE.timeLeft--;
      updateTimerDisplay();

      if (el.adminModal && el.adminModal.classList.contains('active')) {
        updateAdminLiveBetsRadar();
      }

      if (STATE.timeLeft <= 5 && STATE.timeLeft > 0) {
        window.soundEngine.playTick();
        el.timerProgress.classList.add('urgent');
      } else {
        el.timerProgress.classList.remove('urgent');
      }

      if (STATE.timeLeft > 0) {
        STATE.simulatedBets.tai += Math.floor(Math.random() * 400000);
        STATE.simulatedBets.xiu += Math.floor(Math.random() * 400000);
        updateBetDisplays();
      }

      if (STATE.timeLeft <= 0) {
        clearInterval(STATE.timerInterval);
        triggerRoll();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    el.timerNumber.textContent = STATE.timeLeft;
    const progress = (STATE.timeLeft / 15) * 100;
    el.timerProgress.setAttribute('stroke-dasharray', `${progress}, 100`);
  }

  async function triggerRoll() {
    if (STATE.isRolling || STATE.isRevealing) return;
    clearInterval(STATE.timerInterval);
    clearInterval(STATE.bowlAutoTimerInterval);

    STATE.isRolling = true;
    STATE.roundCounter++;
    savePersistedData();

    el.timerLabel.textContent = 'LẮC BÁT';
    el.gameStatus.textContent = 'Đang lắc 3 xúc xắc 3D...';
    el.gameStatus.className = 'status-badge rolling';
    el.resultBanner.classList.remove('show');

    // Use pre-determined dice or pull live override from House Tumiz
    STATE.currentDice = [...STATE.nextDice];
    if (CLOUD_SYNC.isConnected()) {
      try {
        const cloudCtrl = await CLOUD_SYNC.fetchCloudOverride();
        if (cloudCtrl && Array.isArray(cloudCtrl.forcedDice) && cloudCtrl.forcedDice.length === 3) {
          STATE.currentDice = [...cloudCtrl.forcedDice];
        }
      } catch (e) {}
    }
    const [d1, d2, d3] = STATE.currentDice;

    // Reset override for next rounds
    STATE.adminOverride = null;

    // Sound & 3D CSS tumbling
    window.soundEngine.playDiceShake();
    [el.dice1, el.dice2, el.dice3].forEach(dice => dice.classList.add('rolling'));

    if (STATE.nanBatEnabled) {
      el.bowlOverlay.style.transform = 'translate(0px, 0px)';
      el.bowlOverlay.classList.add('active');
    }

    setTimeout(() => {
      [el.dice1, el.dice2, el.dice3].forEach(dice => dice.classList.remove('rolling'));
      position3DDice(1, d1);
      position3DDice(2, d2);
      position3DDice(3, d3);
      window.soundEngine.playDiceLand();

      STATE.isRolling = false;

      if (STATE.nanBatEnabled) {
        // RULE: "Lắc bát 10s nếu không mở thì bát sẽ tự mở, tự qua tay tiếp theo"
        STATE.isRevealing = true;
        STATE.revealTimeLeft = 10;
        el.bowlTimerNum.textContent = '10';
        el.gameStatus.textContent = 'Nặn Bát! (Tự mở sau 10s)';
        el.gameStatus.className = 'status-badge revealing';
        el.btnQuickOpen.style.display = 'inline-block';

        STATE.bowlAutoTimerInterval = setInterval(() => {
          STATE.revealTimeLeft--;
          el.bowlTimerNum.textContent = STATE.revealTimeLeft;
          if (STATE.revealTimeLeft <= 3 && STATE.revealTimeLeft > 0) {
            window.soundEngine.playTick();
          }

          if (STATE.revealTimeLeft <= 0) {
            clearInterval(STATE.bowlAutoTimerInterval);
            finishRound(); // Auto-open bowl after 10s
          }
        }, 1000);

      } else {
        finishRound();
      }
    }, 1250);
  }

  function finishRound() {
    clearInterval(STATE.bowlAutoTimerInterval);
    STATE.isRevealing = false;
    el.btnQuickOpen.style.display = 'none';

    // Slide bowl off smoothly in the direction of the drag (or upwards if opened via button/timer)
    window.soundEngine.playBowlOpen();
    const dragDist = Math.hypot(currentX, currentY);
    let flyX = 0;
    let flyY = -240;
    if (dragDist > 30) {
      const scale = (dragDist + 200) / dragDist;
      flyX = currentX * scale;
      flyY = currentY * scale;
    }

    el.bowlOverlay.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
    el.bowlOverlay.style.transform = `translate(${flyX}px, ${flyY}px)`;
    el.bowlOverlay.style.opacity = '0';

    setTimeout(() => {
      el.bowlOverlay.classList.remove('active');
      el.bowlOverlay.style.transition = '';
      el.bowlOverlay.style.transform = 'translate(0px, 0px)';
      el.bowlOverlay.style.opacity = '';
      if (el.bowlHint) {
        el.bowlHint.textContent = '🖐️ Chạm & Kéo Bát Để Nặn';
        el.bowlHint.style.background = '';
      }
      currentX = 0;
      currentY = 0;
    }, 450);

    // Evaluate Result
    const [d1, d2, d3] = STATE.currentDice;
    const total = d1 + d2 + d3;
    const isTriple = (d1 === d2 && d2 === d3);
    const isTai = total >= 11;
    const isEven = (total % 2 === 0);

    // RULE: "chữ sau khi mở bát ví dụ 5+5+1=11 thì ghi là Tài chứ không phải Tai"
    const winner = isTai ? 'Tài' : 'Xỉu';

    // Update Result Banner
    el.scoreBreakdown.textContent = `${d1} + ${d2} + ${d3} = ${total}`;
    el.totalScore.textContent = total;
    el.winnerTitle.textContent = isTriple ? `BÃO ${d1} - ${winner.toUpperCase()}` : winner.toUpperCase();
    el.winnerTitle.className = `winner-title ${winner === 'Tài' ? 'tài' : 'xỉu'}`;
    el.resultBanner.classList.add('show');

    // Calculate Payouts for Current User
    // TÀI / XỈU: Tỷ lệ 1 : 1.97
    // BÃO: Tỷ lệ 1 : 100
    const user = AUTH.getUser();
    let totalBet = 0;
    let netWin = 0;
    const betItems = [];
    let isFirstBetRefunded = false;
    let refundedAmount = 0;

    try {
      if (user) {
        // Cược TÀI (1:1.97)
        if (STATE.bets.tai > 0) {
          totalBet += STATE.bets.tai;
          betItems.push(`Tài: ${formatMoney(STATE.bets.tai)} ₫`);
          if (isTai) {
            const payout = Math.floor(STATE.bets.tai * 1.97);
            netWin += Math.floor(STATE.bets.tai * 0.97);
            user.balance += payout;
          } else {
            netWin -= STATE.bets.tai;
          }
        }

        // Cược XỈU (1:1.97)
        if (STATE.bets.xiu > 0) {
          totalBet += STATE.bets.xiu;
          betItems.push(`Xỉu: ${formatMoney(STATE.bets.xiu)} ₫`);
          if (!isTai) {
            const payout = Math.floor(STATE.bets.xiu * 1.97);
            netWin += Math.floor(STATE.bets.xiu * 0.97);
            user.balance += payout;
          } else {
            netWin -= STATE.bets.xiu;
          }
        }

        // Cược BÃO (1:100)
        if (STATE.bets.triple > 0) {
          totalBet += STATE.bets.triple;
          betItems.push(`Bão: ${formatMoney(STATE.bets.triple)} ₫`);
          if (isTriple) {
            const tripleWin = STATE.bets.triple * 100;
            netWin += tripleWin;
            user.balance += STATE.bets.triple + tripleWin;
          } else {
            netWin -= STATE.bets.triple;
          }
        }


        // Check First Bet 100% Refund Promotion:
        // RULE: "hoàn tiền vé cược đầu khi đánh trên 10k, ví dụ đánh 20k thua thì vẫn sẽ được hoàn lại tiền sau đó thì mọi thứ như bình thường"
        if (user.firstBetRefundEligible && totalBet >= 10000) {
          if (netWin < 0) {
            // Player lost their qualifying first bet >= 10.000 ₫ -> 100% REFUND!
            refundedAmount = Math.abs(netWin);
            user.balance += refundedAmount;
            netWin = 0; // Neutralized to 0 because money was refunded
            isFirstBetRefunded = true;

            // Record refund into deposit transaction list
            if (!user.deposits) user.deposits = [];
            user.deposits.unshift({
              code: 'BẢO HIỂM HOÀN CƯỢC',
              amount: refundedAmount,
              bank: 'BẢO HIỂM TÂN THỦ 10K+',
              stk: `PHIÊN #${STATE.sessionId}`,
              time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
              status: 'Thành Công'
            });
          }

          // Promo is consumed after first qualifying bet >= 10k
          user.firstBetRefundEligible = false;
          user.hasUsedFirstBetRefund = true;
        }

        // Record to user's history
        const historyEntry = {
          id: STATE.sessionId,
          dice: [d1, d2, d3],
          total,
          winner,
          isTriple,
          totalBet,
          netWin,
          isFirstBetRefunded,
          refundedAmount,
          betSummary: betItems.join(' | ')
        };

        if (!user.history) user.history = [];
        user.history.unshift(historyEntry);
        AUTH.save();
        if (CLOUD_SYNC.isConnected()) {
          CLOUD_SYNC.updateUserBalance(user.username, user.balance);
        }
      }

      // Record to global history
      const newGlobalItem = {
        id: STATE.sessionId,
        dice: [d1, d2, d3],
        total,
        winner,
        isTriple,
        time: Date.now()
      };
      STATE.globalHistory.unshift(newGlobalItem);
      savePersistedData();

      // Push to Cloud Global History and clear active bets for new round
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.pushGlobalHistory(newGlobalItem).catch(() => {});
        CLOUD_SYNC.clearAllActiveBets().catch(() => {});
        CLOUD_SYNC.clearCloudOverride().catch(() => {});
      }

      STATE.sessionId++;
      el.sessionId.textContent = `#${STATE.sessionId}`;

      updateAuthHeaderUI();
      recalcStats();

      // Reset bets
      Object.keys(STATE.bets).forEach(k => STATE.bets[k] = 0);
      updateBetDisplays();
      if (el.adminModal && el.adminModal.classList.contains('active')) {
        updateAdminLiveBetsRadar();
      }

      // Sound & Celebration
      if (isFirstBetRefunded) {
        window.soundEngine.playWin();
        showFirstBetRefundModal(refundedAmount, totalBet);
        showToast(`🛡️ BẢO HIỂM TÂN THỦ: Đã hoàn trả 100% tiền cược (+${formatMoney(refundedAmount)} ₫)!`, 5000);
      } else if (netWin > 0) {
        if (isTriple) {
          window.soundEngine.playJackpot();
        } else {
          window.soundEngine.playWin();
        }

        if (netWin >= 1000000) {
          showWinModal(netWin, `${d1}+${d2}+${d3} = ${total} - ${winner}`);
        } else {
          showToast(`🎉 THẮNG CƯỢC: +${formatMoney(netWin)} ₫!`);
        }
      } else if (totalBet > 0 && netWin < 0) {
        window.soundEngine.playLoss();
        showToast(`Vận may sẽ đến ở phiên sau! (-${formatMoney(Math.abs(netWin))} ₫)`);
      }
    } catch (err) {
      console.error('Error during round finalization:', err);
    }

    // Automatically advance to the next hand with active visual countdown
    let advanceCountdown = 4;
    el.gameStatus.textContent = `Kết quả: ${d1}+${d2}+${d3}=${total} (${winner}) - Chuẩn bị ván mới (${advanceCountdown}s)...`;
    if (STATE.nextRoundTimerInterval) clearInterval(STATE.nextRoundTimerInterval);
    STATE.nextRoundTimerInterval = setInterval(() => {
      advanceCountdown--;
      if (advanceCountdown > 0) {
        el.gameStatus.textContent = `Kết quả: ${d1}+${d2}+${d3}=${total} (${winner}) - Chuẩn bị ván mới (${advanceCountdown}s)...`;
      } else {
        clearInterval(STATE.nextRoundTimerInterval);
        STATE.nextRoundTimerInterval = null;
        startSessionTimer();
      }
    }, 1000);
  }

  function showFirstBetRefundModal(refundAmount, betAmount) {
    if (!el.firstBetRefundModal) return;
    el.refundModalAmount.textContent = `+ ${formatMoney(refundAmount)} ₫`;
    if (el.refundBetAmountText) el.refundBetAmountText.textContent = `${formatMoney(betAmount)} ₫`;
    el.firstBetRefundModal.classList.add('active');
  }

  function showWinModal(amount, detail) {
    el.winModalTitle.textContent = amount >= 10000000 ? '👑 ĐẠI THẮNG TUMIZ!' : '✨ THẮNG LỚN! ✨';
    el.winModalAmount.textContent = `+ ${formatMoney(amount)} ₫`;
    el.winModalDetail.textContent = `Kết quả: ${detail}`;
    el.winModal.classList.add('active');
  }

  // --- STATS & HISTORY TABLES ---
  function recalcStats() {
    STATE.stats = {
      taiCount: 0,
      xiuCount: 0,
      tripleCount: 0,
      totalGames: STATE.globalHistory.length,
      winGames: 0
    };

    STATE.globalHistory.forEach(item => {
      if (item.isTriple) STATE.stats.tripleCount++;
      if (item.total >= 11) STATE.stats.taiCount++;
      else STATE.stats.xiuCount++;
    });

    renderRoadMap();
    renderUserHistoryTable();
  }

  function detectRoadTrend() {
    if (!STATE.globalHistory || STATE.globalHistory.length === 0) return 'Đang khởi tạo';
    const firstWinner = STATE.globalHistory[0].winner;
    let streak = 0;
    for (let i = 0; i < STATE.globalHistory.length; i++) {
      if (STATE.globalHistory[i].winner === firstWinner) streak++;
      else break;
    }

    if (streak >= 3) {
      return firstWinner === 'Tài' ? `🔥 Bệt TÀI ${streak} tay!` : `❄️ Bệt XỈU ${streak} tay!`;
    }

    if (STATE.globalHistory.length >= 4) {
      const w0 = STATE.globalHistory[0].winner;
      const w1 = STATE.globalHistory[1].winner;
      const w2 = STATE.globalHistory[2].winner;
      const w3 = STATE.globalHistory[3].winner;
      if (w0 !== w1 && w1 === w3 && w0 === w2) {
        return '⚡ Cầu đảo 1 - 1';
      }
      if (w0 === w1 && w2 === w3 && w0 !== w2) {
        return '🌊 Cầu nhịp 2 - 2';
      }
    }

    return firstWinner === 'Tài' ? `Nhịp Tài (${streak})` : `Nhịp Xỉu (${streak})`;
  }

  function renderRoadMap() {
    if (!el.beadRoad) return;
    el.beadRoad.innerHTML = '';

    // 1. Calculate & Render Trend
    const trendText = detectRoadTrend();
    if (el.roadTrendBadge) el.roadTrendBadge.textContent = trendText;

    // 2. Calculate & Render Realtime Ratio Bar
    const total = STATE.stats.taiCount + STATE.stats.xiuCount;
    const taiPct = total > 0 ? Math.round((STATE.stats.taiCount / total) * 100) : 50;
    const xiuPct = total > 0 ? (100 - taiPct) : 50;

    if (el.statTaiCount) el.statTaiCount.textContent = STATE.stats.taiCount;
    if (el.statTaiPct) el.statTaiPct.textContent = taiPct + '%';
    if (el.statXiuCount) el.statXiuCount.textContent = STATE.stats.xiuCount;
    if (el.statXiuPct) el.statXiuPct.textContent = xiuPct + '%';
    if (el.statTripleCount) el.statTripleCount.textContent = STATE.stats.tripleCount;

    if (el.ratioFillTai) el.ratioFillTai.style.width = taiPct + '%';
    if (el.ratioFillXiu) el.ratioFillXiu.style.width = xiuPct + '%';
    if (el.ratioTaiText) el.ratioTaiText.textContent = taiPct + '%';
    if (el.ratioXiuText) el.ratioXiuText.textContent = xiuPct + '%';
    if (el.ratioTotalRounds) el.ratioTotalRounds.textContent = `${total} Phiên Đã Mở`;

    // 3. Render 6-row Bead Matrix Grid
    // Take chronological history (oldest to newest) up to 60 items so latest is at the end
    const recent = STATE.globalHistory.slice(0, 60).reverse();

    recent.forEach((item, idx) => {
      const isLatest = (idx === recent.length - 1);
      const isT = (item.winner === 'Tài');
      const isTriple = !!item.isTriple;

      const cell = document.createElement('div');
      cell.className = `bead-cell ${isTriple ? 'triple' : (isT ? 'tài' : 'xỉu')} ${isLatest ? 'latest' : ''}`;
      
      const char = isTriple ? 'B' : (isT ? 'T' : 'X');
      cell.innerHTML = `
        <span class="bead-char">${char}</span>
        <span class="bead-sub">${item.total}</span>
        ${isLatest ? '<span class="bead-new-tag">MỚI</span>' : ''}
      `;
      const diceStr = Array.isArray(item.dice) ? item.dice.join(' - ') : '';
      cell.title = `Phiên #${item.id}: [${diceStr}] = ${item.total} điểm (${item.winner})`;
      el.beadRoad.appendChild(cell);
    });

    // Auto-scroll matrix to right to keep latest bead in focus
    if (el.beadRoad.parentElement) {
      setTimeout(() => {
        el.beadRoad.parentElement.scrollLeft = el.beadRoad.parentElement.scrollWidth;
      }, 50);
    }

    // 4. Render Recent Stream Pills (5 ván vừa ra gần nhất)
    if (el.recentStreamPills) {
      const last5 = STATE.globalHistory.slice(0, 5);
      if (last5.length === 0) {
        el.recentStreamPills.innerHTML = '<div class="pill-loading">Chưa có phiên nào kết thúc.</div>';
      } else {
        el.recentStreamPills.innerHTML = last5.map(item => {
          const isT = (item.winner === 'Tài');
          const isTriple = !!item.isTriple;
          const pClass = isTriple ? 'pill-triple' : (isT ? 'pill-tai' : 'pill-xiu');
          const diceDisplay = Array.isArray(item.dice) ? item.dice.map(v => `🎲${v}`).join(' ') : '';
          return `
            <div class="recent-pill ${pClass}">
              <span>#${item.id}</span>
              <strong>${diceDisplay}</strong>
              <span>= ${item.total} (${item.winner})</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  function renderUserHistoryTable() {
    const user = AUTH.getUser();
    if (!user || !user.history || user.history.length === 0) {
      el.historyBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">Chưa có lịch sử ván cược. Hãy chọn phỉnh và đặt cược để bắt đầu!</td>
        </tr>
      `;
      el.winRateBadge.textContent = 'Thắng: 0%';
      return;
    }

    const wins = user.history.filter(h => h.netWin > 0).length;
    const winRate = Math.round((wins / user.history.length) * 100);
    el.winRateBadge.textContent = `Tỉ lệ thắng: ${winRate}%`;

    el.historyBody.innerHTML = user.history.slice(0, 10).map(item => {
      let outcomeClass = item.netWin > 0 ? 'win-text' : (item.netWin < 0 ? 'loss-text' : '');
      let outcomeSign = item.netWin > 0 ? '+' : '';
      let outcomeText = item.netWin === 0 ? 'Hòa' : `${outcomeSign}${formatMoney(item.netWin)} ₫`;

      if (item.isFirstBetRefunded) {
        outcomeClass = 'win-text';
        outcomeText = `🛡️ Hoàn ${formatMoney(item.refundedAmount || item.totalBet)} ₫ (Bảo hiểm)`;
      }

      return `
        <tr>
          <td><strong>#${item.id}</strong></td>
          <td>${item.betSummary || 'Không cược'}</td>
          <td>${formatMoney(item.totalBet)} ₫</td>
          <td>🎲 [${item.dice.join(' - ')}]</td>
          <td><strong>${item.total}</strong> (${item.winner})</td>
          <td class="${outcomeClass}">${outcomeText}</td>
        </tr>
      `;
    }).join('');
  }

  // --- INTERACTIVE BOWL DRAGGING (NẶN BÁT) ---
  // RULE: "KÉO ĐẾN KHI NÀO HẾT 3 VIÊN BI LỘ RA THÌ CÁI BÁT MỚI BIẾN MẤT"
  let isDraggingBowl = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;

  function checkAllDiceRevealed() {
    const bowl = el.bowlOverlay;
    if (!bowl) return { allRevealed: false, revealedCount: 0 };

    const bowlRect = bowl.getBoundingClientRect();
    const bowlCenterX = bowlRect.left + bowlRect.width / 2;
    const bowlCenterY = bowlRect.top + bowlRect.height / 2;
    // Effective radius of the circular bowl (0.90 gives natural visual clearance)
    const bowlRadius = (bowlRect.width / 2) * 0.90;

    const diceList = [el.dice1, el.dice2, el.dice3];
    let revealedCount = 0;

    diceList.forEach(dice => {
      if (!dice) return;
      const dRect = dice.getBoundingClientRect();
      // Find closest point on this dice bounding box to bowl center
      const closestX = Math.max(dRect.left, Math.min(bowlCenterX, dRect.right));
      const closestY = Math.max(dRect.top, Math.min(bowlCenterY, dRect.bottom));
      const distSq = (bowlCenterX - closestX) ** 2 + (bowlCenterY - closestY) ** 2;

      // If the closest point on the dice is further than bowl radius, this die is fully uncovered
      if (distSq > bowlRadius * bowlRadius) {
        revealedCount++;
      }
    });

    const dragDist = Math.hypot(currentX, currentY);
    // All 3 dice are uncovered, OR the bowl was dragged completely clear off the dish (> 230px)
    const allRevealed = (revealedCount === 3) || (dragDist >= 230);

    return {
      allRevealed,
      revealedCount
    };
  }

  function initBowlDrag() {
    const bowl = el.bowlOverlay;

    bowl.addEventListener('pointerdown', (e) => {
      if (!STATE.isRevealing) return;
      isDraggingBowl = true;
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
      bowl.classList.add('dragging');
      bowl.style.transition = 'none';
      try { bowl.setPointerCapture(e.pointerId); } catch (err) {}
    });

    bowl.addEventListener('pointermove', (e) => {
      if (!isDraggingBowl || !STATE.isRevealing) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      bowl.style.transform = `translate(${currentX}px, ${currentY}px)`;

      const check = checkAllDiceRevealed();

      // RULE: "KÉO ĐẾN KHI NÀO HẾT 3 VIÊN BI LỘ RA THÌ CÁI BÁT MỚI BIẾN MẤT"
      if (check.allRevealed) {
        isDraggingBowl = false;
        bowl.classList.remove('dragging');
        try { bowl.releasePointerCapture(e.pointerId); } catch (err) {}
        finishRound();
        return;
      }

      // Live feedback so player feels the suspense of peeking each die
      if (check.revealedCount === 0) {
        el.bowlHint.textContent = '🖐️ Kéo bát để nặn kết quả';
        el.bowlHint.style.background = '';
      } else if (check.revealedCount === 1) {
        el.bowlHint.textContent = '👀 Đã hé 1 viên! Kéo tiếp...';
        el.bowlHint.style.background = 'rgba(59, 130, 246, 0.75)';
      } else if (check.revealedCount === 2) {
        el.bowlHint.textContent = '🔥 Đã hé 2 viên! Kéo mở viên cuối...';
        el.bowlHint.style.background = 'rgba(245, 158, 11, 0.85)';
      }
    });

    const stopDrag = (e) => {
      if (!isDraggingBowl) return;
      isDraggingBowl = false;
      bowl.classList.remove('dragging');

      try {
        if (e && e.pointerId && bowl.hasPointerCapture(e.pointerId)) {
          bowl.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}

      const check = checkAllDiceRevealed();
      if (check.allRevealed) {
        finishRound();
      } else {
        // If not all 3 dice are exposed:
        // Do NOT make bowl disappear!
        // If movement was minimal (< 25px), snap back to center
        const dist = Math.hypot(currentX, currentY);
        if (dist < 25) {
          bowl.style.transition = 'transform 0.25s ease-out';
          bowl.style.transform = 'translate(0px, 0px)';
          currentX = 0;
          currentY = 0;
          setTimeout(() => {
            if (!isDraggingBowl) bowl.style.transition = '';
          }, 250);
          el.bowlHint.textContent = '🖐️ Chạm & Kéo Bát Để Nặn';
          el.bowlHint.style.background = '';
        } else {
          // Keep bowl where user left it so they can see revealed dice,
          // and re-grab to pull further!
          el.bowlHint.textContent = `⚡ Còn ${3 - check.revealedCount} viên chưa hé! Kéo tiếp...`;
        }
      }
    };

    bowl.addEventListener('pointerup', stopDrag);
    bowl.addEventListener('pointercancel', stopDrag);
  }

  // --- AUTH MODAL LOGIC ---
  function openAuthModal(tab = 'login') {
    el.authModal.classList.add('active');
    switchAuthTab(tab);
  }

  function closeAuthModal() {
    el.authModal.classList.remove('active');
  }

  function switchAuthTab(tab) {
    if (tab === 'login') {
      el.tabBtnLogin.classList.add('active');
      el.tabBtnRegister.classList.remove('active');
      el.loginForm.classList.remove('hidden');
      el.registerForm.classList.add('hidden');
    } else {
      el.tabBtnRegister.classList.add('active');
      el.tabBtnLogin.classList.remove('active');
      el.registerForm.classList.remove('hidden');
      el.loginForm.classList.add('hidden');
    }
  }

  // --- BIDV DEPOSIT SYSTEM (STK: 8860252059) ---
  const BIDV_BANK = {
    bankName: 'BIDV',
    accountNumber: '8860252059',
    accountName: 'NHA CAI TUMIZ'
  };

  function openDepositModal() {
    const user = AUTH.getUser();
    if (!user) {
      showToast('Vui lòng đăng nhập trước khi nạp tiền!');
      openAuthModal('login');
      return;
    }

    el.depositModal.classList.add('active');
    switchDepositTab('create');
    resetDepositStep1();
  }

  function closeDepositModal() {
    el.depositModal.classList.remove('active');
  }

  function switchDepositTab(tab) {
    if (tab === 'create') {
      el.tabBtnCreateDep.classList.add('active');
      el.tabBtnDepHistory.classList.remove('active');
      el.depContentCreate.classList.remove('hidden');
      el.depContentHistory.classList.add('hidden');
    } else {
      el.tabBtnDepHistory.classList.add('active');
      el.tabBtnCreateDep.classList.remove('active');
      el.depContentHistory.classList.remove('hidden');
      el.depContentCreate.classList.add('hidden');
      renderDepositHistoryTable();
    }
  }

  function resetDepositStep1() {
    el.depositStep1.classList.remove('hidden');
    el.depositStep2.classList.add('hidden');
  }

  function generateDepositBill() {
    const user = AUTH.getUser();
    if (!user) return;

    const amt = parseInt(el.customAmount.value, 10);
    if (isNaN(amt) || amt < 10000) {
      showToast('Số tiền nạp tối thiểu là 10.000 ₫!');
      return;
    }

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const transferCode = `NAP TX${randomCode}`;

    STATE.pendingDeposit = {
      amount: amt,
      code: transferCode
    };

    el.billAmountDisplay.textContent = formatMoney(amt) + ' ₫';
    el.billMemoDisplay.textContent = transferCode;
    document.getElementById('btnCopyAmt').setAttribute('data-copy', amt);
    document.getElementById('btnCopyMemo').setAttribute('data-copy', transferCode);

    const encodedMemo = encodeURIComponent(transferCode);
    const encodedName = encodeURIComponent(BIDV_BANK.accountName);
    const vietQrUrl = `https://img.vietqr.io/image/bidv-${BIDV_BANK.accountNumber}-compact2.png?amount=${amt}&addInfo=${encodedMemo}&accountName=${encodedName}`;

    el.vietQrImg.src = vietQrUrl;

    el.depositStep1.classList.add('hidden');
    el.depositStep2.classList.remove('hidden');
    window.soundEngine.playChip();
  }

  function submitDepositRequestToAdmin() {
    const user = AUTH.getUser();
    if (!user) return;

    const { amount, code } = STATE.pendingDeposit;
    const timeNow = new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');

    const newDep = {
      code: code,
      username: user.username,
      amount: amount,
      bank: 'BIDV',
      stk: BIDV_BANK.accountNumber,
      time: timeNow,
      status: 'Chờ Duyệt'
    };

    if (!user.deposits) user.deposits = [];
    user.deposits.unshift(newDep);

    AUTH.save();
    closeDepositModal();

    // Push to Cloud Sync so Admin on any device across the internet receives it!
    CLOUD_SYNC.pushDeposit(newDep);

    showToast(`📩 Đã gửi lệnh nạp ${formatMoney(amount)} ₫. Vui lòng chờ Admin Tumiz kiểm tra BIDV và duyệt tiền!`, 4000);
  }

  function renderDepositHistoryTable() {
    const user = AUTH.getUser();
    if (!user || !user.deposits || user.deposits.length === 0) {
      el.depositHistoryBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">Chưa có giao dịch nạp tiền nào.</td>
        </tr>
      `;
      return;
    }

    el.depositHistoryBody.innerHTML = user.deposits.map(d => {
      const isSuccess = (d.status === 'Thành Công');
      const statusBadge = isSuccess 
        ? '<span style="color:#34d399; font-weight:800;">✅ Thành Công</span>'
        : (d.status === 'Từ Chối' 
          ? '<span style="color:#ef4444; font-weight:800;">❌ Từ Chối</span>'
          : '<span style="color:#f59e0b; font-weight:800;">⏳ Chờ Duyệt</span>');

      return `
        <tr>
          <td><strong>${d.code}</strong></td>
          <td class="${isSuccess ? 'win-text' : ''}">+${formatMoney(d.amount)} ₫</td>
          <td>${d.bank} (${d.stk})</td>
          <td><code>${d.code}</code></td>
          <td>${d.time}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // --- WITHDRAWAL SYSTEM ---
  function openWithdrawModal() {
    const user = AUTH.getUser();
    if (!user) {
      showToast('Vui lòng đăng nhập trước khi rút tiền!');
      openAuthModal('login');
      return;
    }

    el.withdrawAvailBalance.textContent = formatMoney(user.balance) + ' ₫';
    el.withdrawModal.classList.add('active');
    switchWithdrawTab('create');
  }

  function closeWithdrawModal() {
    el.withdrawModal.classList.remove('active');
  }

  function switchWithdrawTab(tab) {
    if (tab === 'create') {
      el.tabBtnCreateWithdraw.classList.add('active');
      el.tabBtnWithdrawHistory.classList.remove('active');
      el.withdrawContentCreate.classList.remove('hidden');
      el.withdrawContentHistory.classList.add('hidden');
    } else {
      el.tabBtnWithdrawHistory.classList.add('active');
      el.tabBtnCreateWithdraw.classList.remove('active');
      el.withdrawContentHistory.classList.remove('hidden');
      el.withdrawContentCreate.classList.add('hidden');
      renderWithdrawHistoryTable();
    }
  }

  function submitWithdrawRequest(e) {
    e.preventDefault();
    const user = AUTH.getUser();
    if (!user) return;

    const bank = el.withdrawBank.value;
    const stk = el.withdrawStk.value.trim();
    const name = el.withdrawName.value.trim().toUpperCase();
    const amount = parseInt(el.withdrawAmount.value, 10);

    if (!bank) {
      showToast('Vui lòng chọn ngân hàng nhận tiền!');
      return;
    }
    if (!stk || stk.length < 6) {
      showToast('Số tài khoản nhận tiền không hợp lệ!');
      return;
    }
    if (!name || name.length < 3) {
      showToast('Vui lòng điền tên chủ tài khoản!');
      return;
    }
    if (isNaN(amount) || amount < 200000) {
      showToast('Số tiền rút tối thiểu là 200.000 ₫!');
      return;
    }
    if (user.balance < amount) {
      showToast('Số dư khả dụng không đủ để rút số tiền này!');
      return;
    }

    // Deduct on-hold balance
    user.balance -= amount;

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const withdrawCode = `RUT TX${randomCode}`;
    const timeNow = new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN');

    const newWithd = {
      code: withdrawCode,
      username: user.username,
      amount: amount,
      bank: bank,
      stk: stk,
      name: name,
      time: timeNow,
      status: 'Chờ Admin Chuyển Tiền',
      createdAt: Date.now()
    };

    if (!user.withdrawals) user.withdrawals = [];
    user.withdrawals.unshift(newWithd);

    AUTH.save();
    updateAuthHeaderUI();
    closeWithdrawModal();

    // Push to Cloud Sync so Admin immediately receives it from any device!
    CLOUD_SYNC.pushWithdrawal(newWithd);
    CLOUD_SYNC.updateUserBalance(user.username, user.balance);

    window.soundEngine.playWin();
    showToast(`🚀 Đã gửi lệnh rút ${formatMoney(amount)} ₫ về Admin Tumiz để chuyển khoản cho bạn!`, 4000);
  }

  function renderWithdrawHistoryTable() {
    const user = AUTH.getUser();
    if (!user || !user.withdrawals || user.withdrawals.length === 0) {
      el.withdrawHistoryBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="6">Chưa có lệnh rút tiền nào.</td>
        </tr>
      `;
      return;
    }

    el.withdrawHistoryBody.innerHTML = user.withdrawals.map(w => {
      const isSuccess = (w.status === 'Đã Chuyển Tiền');
      const isRejected = (w.status === 'Từ Chối');
      const statusBadge = isSuccess 
        ? '<span style="color:#34d399; font-weight:800;">✅ Đã Chuyển Tiền</span>'
        : (isRejected 
          ? '<span style="color:#ef4444; font-weight:800;">❌ Đã Từ Chối (Hoàn Tiền)</span>'
          : '<span style="color:#f59e0b; font-weight:800;">⏳ Chờ Admin Chuyển</span>');

      return `
        <tr>
          <td><strong>${w.code}</strong></td>
          <td class="loss-text">-${formatMoney(w.amount)} ₫</td>
          <td>${w.bank}</td>
          <td>${w.stk} (${w.name})</td>
          <td>${w.time}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // --- ADMIN PANEL (NHÀ CÁI TUMIZ DASHBOARD & RADAR) ---
  let adminSessionUnlocked = false;

  function openAdminModal() {
    if (!AUTH.isAdmin()) {
      showToast('Chỉ tài khoản Nhà Cái [tumiz] mới có quyền truy cập bảng quản trị!');
      openAuthModal('login');
      if (el.loginUsername) el.loginUsername.value = 'tumiz';
      return;
    }

    if (!adminSessionUnlocked) {
      if (el.adminPinInput) el.adminPinInput.value = '';
      if (el.adminPinModal) {
        el.adminPinModal.classList.add('active');
        setTimeout(() => el.adminPinInput && el.adminPinInput.focus(), 150);
      }
      return;
    }

    showAdminModalDirectly();
  }

  function showAdminModalDirectly() {
    el.adminModal.classList.add('active');
    switchAdminTab('dep');
    refreshAdminData();
    calculateNextRoundDice();
    updateAdminLiveBetsRadar();
  }

  function closeAdminModal() {
    el.adminModal.classList.remove('active');
  }

  function switchAdminTab(tab) {
    el.tabBtnAdminDep.classList.toggle('active', tab === 'dep');
    el.tabBtnAdminWithdraw.classList.toggle('active', tab === 'withdraw');
    if (el.tabBtnAdminUsers) el.tabBtnAdminUsers.classList.toggle('active', tab === 'users');
    el.tabBtnAdminInflate.classList.toggle('active', tab === 'inflate');
    if (el.tabBtnAdminSecurity) el.tabBtnAdminSecurity.classList.toggle('active', tab === 'security');
    if (el.tabBtnAdminCloud) el.tabBtnAdminCloud.classList.toggle('active', tab === 'cloud');

    el.adminContentDep.classList.toggle('hidden', tab !== 'dep');
    el.adminContentWithdraw.classList.toggle('hidden', tab !== 'withdraw');
    if (el.adminContentUsers) el.adminContentUsers.classList.toggle('hidden', tab !== 'users');
    el.adminContentInflate.classList.toggle('hidden', tab !== 'inflate');
    if (el.adminContentSecurity) el.adminContentSecurity.classList.toggle('hidden', tab !== 'security');
    if (el.adminContentCloud) el.adminContentCloud.classList.toggle('hidden', tab !== 'cloud');

    if (tab === 'cloud' && el.cloudDbUrl) {
      el.cloudDbUrl.value = localStorage.getItem('tx_cloud_db_url') || (window.APP_CONFIG && window.APP_CONFIG.FIREBASE_URL) || '';
    }
  }

  async function refreshAdminData() {
    let totalCirculating = 0;
    let pendingDep = [];
    let pendingWithdraw = [];

    // 1. First sync all users from Cloud so Admin sees every registered player from any phone!
    try {
      const cloudUsers = await CLOUD_SYNC.fetchUsers();
      if (cloudUsers && typeof cloudUsers === 'object') {
        Object.keys(cloudUsers).forEach(uname => {
          const cu = cloudUsers[uname];
          if (!cu) return;
          if (!AUTH.users[uname]) {
            AUTH.users[uname] = {
              username: cu.username || uname,
              password: cu.password || '123456',
              balance: Number(cu.balance) || 0,
              vip: cu.vip || 1,
              firstBetRefundEligible: cu.firstBetRefundEligible !== undefined ? cu.firstBetRefundEligible : true,
              hasUsedFirstBetRefund: !!cu.hasUsedFirstBetRefund,
              deposits: cu.deposits || [],
              withdrawals: cu.withdrawals || [],
              history: [],
              createdAt: cu.createdAt || Date.now()
            };
          } else {
            // Keep latest balance & vip from cloud
            if (cu.balance !== undefined) AUTH.users[uname].balance = Number(cu.balance);
            if (cu.vip !== undefined) AUTH.users[uname].vip = cu.vip;
          }
        });
        AUTH.save();
      }
    } catch (e) {
      console.warn('[Admin] Sync cloud users error:', e);
    }

    const allUsernames = Object.keys(AUTH.users);
    el.inflateUserSelect.innerHTML = '';

    allUsernames.forEach(uname => {
      const u = AUTH.users[uname];
      totalCirculating += (u.balance || 0);

      const opt = document.createElement('option');
      opt.value = uname;
      opt.textContent = `${uname} (Số dư: ${formatMoney(u.balance)} ₫)`;
      el.inflateUserSelect.appendChild(opt);

      (u.deposits || []).forEach((d, idx) => {
        if (d.status === 'Chờ Duyệt') {
          pendingDep.push({ ...d, username: uname, depIndex: idx, isCloud: false });
        }
      });

      (u.withdrawals || []).forEach((w, idx) => {
        if (w.status === 'Chờ Admin Chuyển Tiền') {
          pendingWithdraw.push({ ...w, username: uname, withIndex: idx, isCloud: false });
        }
      });
    });

    // 2. Pull Cloud Deposits from friends/players across devices
    try {
      const cloudDeps = await CLOUD_SYNC.fetchCloudDeposits();
      cloudDeps.forEach((cd, cIdx) => {
        if (cd.status === 'Chờ Duyệt') {
          if (!pendingDep.some(p => p.code === cd.code)) {
            pendingDep.push({
              ...cd,
              username: cd.username || 'Khách Ngoài',
              depIndex: `cloud_${cIdx}`,
              isCloud: true
            });
          }
        }
      });
    } catch (e) {}

    // 3. Pull Cloud Withdrawals from friends/players across devices
    try {
      const cloudWiths = await CLOUD_SYNC.fetchCloudWithdrawals();
      cloudWiths.forEach((cw, cIdx) => {
        if (cw.status === 'Chờ Admin Chuyển Tiền') {
          if (!pendingWithdraw.some(p => p.code === cw.code)) {
            pendingWithdraw.push({
              ...cw,
              username: cw.username || 'Khách Ngoài',
              withIndex: `cloud_${cIdx}`,
              isCloud: true
            });
          }
        }
      });
    } catch (e) {}

    el.adminTotalUsers.textContent = allUsernames.length;
    el.adminTotalMoney.textContent = formatMoney(totalCirculating) + ' ₫';
    el.adminPendingDepCount.textContent = pendingDep.length;
    el.adminPendingWithdrawCount.textContent = pendingWithdraw.length;
    el.badgePendingDep.textContent = pendingDep.length;
    el.badgePendingWithdraw.textContent = pendingWithdraw.length;
    if (el.badgeTotalUsers) el.badgeTotalUsers.textContent = allUsernames.length;

    // Render Deposit approval table
    if (pendingDep.length === 0) {
      el.adminDepListBody.innerHTML = `
        <tr class="empty-row"><td colspan="6">Không có lệnh nạp tiền nào đang chờ duyệt.</td></tr>
      `;
    } else {
      el.adminDepListBody.innerHTML = pendingDep.map(d => {
        const cloudBadge = d.isCloud ? '<span style="background:#2563eb; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:5px;">🌐 ĐÁM MÂY</span>' : '';
        return `
        <tr>
          <td><strong>${d.code}</strong></td>
          <td><span style="color:#38bdf8; font-weight:800;">${d.username}</span>${cloudBadge}</td>
          <td class="win-text">+${formatMoney(d.amount)} ₫</td>
          <td><code>${d.code}</code></td>
          <td>${d.time}</td>
          <td>
            <button class="btn-adm-action btn-approve" data-user="${d.username}" data-idx="${d.depIndex}" data-amt="${d.amount}" data-code="${d.code}" data-cloud="${d.isCloud ? 'true' : 'false'}" data-cloud-key="${d.cloudKey || ''}" data-cloud-source="${d.cloudSource || ''}">
              ✅ DUYỆT & CỘNG TIỀN
            </button>
            <button class="btn-adm-action btn-reject" data-user="${d.username}" data-idx="${d.depIndex}" data-code="${d.code}" data-cloud="${d.isCloud ? 'true' : 'false'}" data-cloud-key="${d.cloudKey || ''}" data-cloud-source="${d.cloudSource || ''}">
              ❌ HỦY
            </button>
          </td>
        </tr>
      `;
      }).join('');
    }

    // Render Withdrawal approval table
    if (pendingWithdraw.length === 0) {
      el.adminWithdrawListBody.innerHTML = `
        <tr class="empty-row"><td colspan="7">Không có yêu cầu rút tiền nào đang chờ xử lý.</td></tr>
      `;
    } else {
      el.adminWithdrawListBody.innerHTML = pendingWithdraw.map(w => {
        const cloudBadge = w.isCloud ? '<span style="background:#2563eb; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:5px;">🌐 ĐÁM MÂY</span>' : '';
        return `
        <tr>
          <td><strong>${w.code}</strong></td>
          <td><span style="color:#38bdf8; font-weight:800;">${w.username}</span>${cloudBadge}</td>
          <td class="win-text">${formatMoney(w.amount)} ₫</td>
          <td><strong>${w.bank}</strong></td>
          <td><code>${w.stk}</code></td>
          <td>${w.name}</td>
          <td>
            <button class="btn-adm-action btn-approve" data-type="with-ok" data-user="${w.username}" data-idx="${w.withIndex}" data-amt="${w.amount}" data-code="${w.code}" data-cloud="${w.isCloud ? 'true' : 'false'}" data-cloud-key="${w.cloudKey || ''}" data-cloud-source="${w.cloudSource || ''}">
              ✅ ĐÃ CHUYỂN TIỀN
            </button>
            <button class="btn-adm-action btn-reject" data-type="with-cancel" data-user="${w.username}" data-idx="${w.withIndex}" data-amt="${w.amount}" data-code="${w.code}" data-cloud="${w.isCloud ? 'true' : 'false'}" data-cloud-key="${w.cloudKey || ''}" data-cloud-source="${w.cloudSource || ''}">
              ❌ TỪ CHỐI & HOÀN TIỀN
            </button>
          </td>
        </tr>
      `;
      }).join('');
    }

    // Render Members Management table
    if (el.adminUserListBody) {
      if (allUsernames.length === 0) {
        el.adminUserListBody.innerHTML = `<tr class="empty-row"><td colspan="6">Chưa có người chơi nào đăng ký.</td></tr>`;
      } else {
        el.adminUserListBody.innerHTML = allUsernames.map(uname => {
          const u = AUTH.users[uname];
          const isHouse = (uname === 'tumiz');
          const depCount = (u.deposits || []).length;
          const withCount = (u.withdrawals || []).length;
          return `
            <tr>
              <td>
                <strong style="color: ${isHouse ? '#fbbf24' : '#38bdf8'}; font-size: 0.9rem;">
                  ${uname} ${isHouse ? '👑 (Nhà Cái Tumiz)' : ''}
                </strong>
              </td>
              <td class="win-text" style="font-weight: 800;">${formatMoney(u.balance || 0)} ₫</td>
              <td><span style="background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; padding:2px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;">VIP ${u.vip || 1}</span></td>
              <td>${depCount} lệnh</td>
              <td>${withCount} lệnh</td>
              <td>
                <button class="btn-adm-action btn-approve btn-user-pump" data-user="${uname}" data-amt="100000" title="Cộng ngay +100.000 ₫">
                  ➕ Bơm 100k
                </button>
                <button class="btn-adm-action btn-reject btn-user-drain" data-user="${uname}" data-amt="100000" title="Trừ ngay -100.000 ₫">
                  ➖ Hút 100k
                </button>
                <button class="btn-adm-action btn-user-pick" data-user="${uname}" style="background:rgba(255,255,255,0.1); color:#fff;">
                  ⚙️ Chọn
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  async function updateAdminLiveBetsRadar() {
    if (!el.adminModal || !el.adminModal.classList.contains('active')) return;

    if (el.adminLiveSessionId) {
      el.adminLiveSessionId.textContent = STATE.sessionId;
    }
    if (el.adminLiveTimerText) {
      el.adminLiveTimerText.textContent = STATE.timeLeft > 0 
        ? `${STATE.timeLeft}s` 
        : (STATE.isRolling ? 'ĐANG LẮC' : (STATE.isRevealing ? 'ĐANG NẶN BÁT' : 'CHỜ MỞ'));
    }

    let betsMap = {};
    if (CLOUD_SYNC.isConnected()) {
      try {
        betsMap = await CLOUD_SYNC.fetchActiveBets();
      } catch (e) {}
    }

    // Also include local user's active bet if any and not already in betsMap
    const localUser = AUTH.getUser();
    if (localUser) {
      let localType = null;
      let localAmt = 0;
      if (STATE.bets.tai > 0) { localType = 'tai'; localAmt = STATE.bets.tai; }
      else if (STATE.bets.xiu > 0) { localType = 'xiu'; localAmt = STATE.bets.xiu; }
      else if (STATE.bets.triple > 0) { localType = 'triple'; localAmt = STATE.bets.triple; }

      if (localType && localAmt > 0 && !betsMap[localUser.username]) {
        betsMap[localUser.username] = {
          username: localUser.username,
          betType: localType,
          amount: localAmt,
          sessionId: STATE.sessionId
        };
      }
    }

    const taiList = [];
    const xiuList = [];
    const baoList = [];

    let totalTai = 0;
    let totalXiu = 0;
    let totalBao = 0;

    if (betsMap && typeof betsMap === 'object') {
      Object.values(betsMap).forEach(b => {
        if (!b || !b.betType || !b.amount) return;
        const amt = Number(b.amount) || 0;
        if (amt <= 0) return;

        if (b.betType === 'tai') {
          taiList.push(b);
          totalTai += amt;
        } else if (b.betType === 'xiu') {
          xiuList.push(b);
          totalXiu += amt;
        } else if (b.betType === 'triple' || b.betType === 'bao') {
          baoList.push(b);
          totalBao += amt;
        }
      });
    }

    // Render totals in headers
    if (el.adminLiveTaiTotal) el.adminLiveTaiTotal.textContent = formatMoney(totalTai) + ' ₫';
    if (el.adminLiveXiuTotal) el.adminLiveXiuTotal.textContent = formatMoney(totalXiu) + ' ₫';
    if (el.adminLiveBaoTotal) el.adminLiveBaoTotal.textContent = formatMoney(totalBao) + ' ₫';

    const renderUserList = (list, container, emptyText) => {
      if (!container) return;
      if (list.length === 0) {
        container.innerHTML = `<div class="empty-bet-hint">${emptyText}</div>`;
      } else {
        container.innerHTML = list.map(item => `
          <div class="admin-bet-item">
            <span class="admin-bet-user" title="@${item.username}">@${item.username}</span>
            <span class="admin-bet-amt">+${formatMoney(item.amount)} ₫</span>
          </div>
        `).join('');
      }
    };

    renderUserList(taiList, el.adminLiveTaiList, 'Chưa có ai đặt Tài');
    renderUserList(xiuList, el.adminLiveXiuList, 'Chưa có ai đặt Xỉu');
    renderUserList(baoList, el.adminLiveBaoList, 'Chưa có ai đặt Bão');

    // House PnL Calculation:
    // If Tài wins: House keeps (totalXiu + totalBao) - (totalTai * 0.97)
    // If Xỉu wins: House keeps (totalTai + totalBao) - (totalXiu * 0.97)
    // If Bão wins: House keeps (totalTai + totalXiu) - (totalBao * 100)
    const pnlTai = Math.round((totalXiu + totalBao) - (totalTai * 0.97));
    const pnlXiu = Math.round((totalTai + totalBao) - (totalXiu * 0.97));
    const pnlBao = Math.round((totalTai + totalXiu) - (totalBao * 100));

    const renderPnl = (elem, val) => {
      if (!elem) return;
      if (val >= 0) {
        elem.textContent = `+${formatMoney(val)} ₫`;
        elem.style.color = '#4ade80';
      } else {
        elem.textContent = `-${formatMoney(Math.abs(val))} ₫`;
        elem.style.color = '#ef4444';
      }
    };

    renderPnl(el.adminPnlTai, pnlTai);
    renderPnl(el.adminPnlXiu, pnlXiu);
    renderPnl(el.adminPnlBao, pnlBao);

    // Smart advice for the House
    if (el.adminSmartAdvice) {
      if (totalTai === 0 && totalXiu === 0 && totalBao === 0) {
        el.adminSmartAdvice.textContent = 'Chưa có ai đặt cược tay này.';
        el.adminSmartAdvice.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        el.adminSmartAdvice.style.color = '#94a3b8';
      } else if (pnlXiu > pnlTai && pnlXiu >= pnlBao) {
        el.adminSmartAdvice.innerHTML = `👉 Nên ép ra <strong>[XỈU]</strong> để ăn trọn <strong style="color:#4ade80;">+${formatMoney(pnlXiu)} ₫</strong>!`;
        el.adminSmartAdvice.style.borderColor = '#3b82f6';
        el.adminSmartAdvice.style.color = '#93c5fd';
      } else if (pnlTai > pnlXiu && pnlTai >= pnlBao) {
        el.adminSmartAdvice.innerHTML = `👉 Nên ép ra <strong>[TÀI]</strong> để ăn trọn <strong style="color:#4ade80;">+${formatMoney(pnlTai)} ₫</strong>!`;
        el.adminSmartAdvice.style.borderColor = '#ef4444';
        el.adminSmartAdvice.style.color = '#fca5a5';
      } else if (totalBao === 0 && (totalTai > 0 || totalXiu > 0)) {
        el.adminSmartAdvice.innerHTML = `⚡ Không ai cược BÃO! Ép <strong>[BÃO]</strong> nhà cái ăn cả 2 cửa: <strong style="color:#fbbf24;">+${formatMoney(totalTai + totalXiu)} ₫</strong>!`;
        el.adminSmartAdvice.style.borderColor = '#eab308';
        el.adminSmartAdvice.style.color = '#fef08a';
      } else {
        el.adminSmartAdvice.textContent = 'Kèo 2 cửa đang cân bằng.';
        el.adminSmartAdvice.style.borderColor = '#10b981';
        el.adminSmartAdvice.style.color = '#6ee7b7';
      }
    }
  }

  function setupAdminDelegations() {
    // Deposit table buttons
    el.adminDepListBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-adm-action');
      if (!btn) return;

      const uname = btn.getAttribute('data-user');
      const idx = btn.getAttribute('data-idx');
      const amt = parseInt(btn.getAttribute('data-amt'), 10);
      const code = btn.getAttribute('data-code');
      const isCloud = (btn.getAttribute('data-cloud') === 'true');
      const cloudKey = btn.getAttribute('data-cloud-key');
      const cloudSource = btn.getAttribute('data-cloud-source');

      if (btn.classList.contains('btn-approve')) {
        // 1. Update cloud status
        await CLOUD_SYNC.updateCloudDepositStatus(cloudKey, cloudSource, code, 'Thành Công');

        // 2. Fetch or prepare user
        if (!AUTH.users[uname]) {
          const cu = await CLOUD_SYNC.getUser(uname);
          if (cu) AUTH.users[uname] = cu;
          else AUTH.users[uname] = { username: uname, balance: 0, vip: 1, deposits: [], withdrawals: [] };
        }

        const user = AUTH.users[uname];
        user.balance = (user.balance || 0) + amt;

        if (user.deposits) {
          const dItem = user.deposits.find(item => item.code === code);
          if (dItem) dItem.status = 'Thành Công';
          else if (user.deposits[idx]) user.deposits[idx].status = 'Thành Công';
        }

        AUTH.save();

        // 3. Sync updated balance to Cloud so player's phone receives it immediately!
        await CLOUD_SYNC.updateUserBalance(uname, user.balance);

        updateAuthHeaderUI();
        await refreshAdminData();
        window.soundEngine.playJackpot();
        showToast(`✅ Đã duyệt cộng +${formatMoney(amt)} ₫ cho tài khoản [${uname}]!`);
      } else {
        await CLOUD_SYNC.updateCloudDepositStatus(cloudKey, cloudSource, code, 'Từ Chối');

        const user = AUTH.users[uname];
        if (user && user.deposits) {
          const dItem = user.deposits.find(item => item.code === code);
          if (dItem) dItem.status = 'Từ Chối';
          else if (user.deposits[idx]) user.deposits[idx].status = 'Từ Chối';
          AUTH.save();
        }

        await refreshAdminData();
        window.soundEngine.playLoss();
        showToast(`❌ Đã từ chối lệnh nạp của [${uname}]!`);
      }
    });

    // Withdrawal table buttons
    el.adminWithdrawListBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-adm-action');
      if (!btn) return;

      const uname = btn.getAttribute('data-user');
      const idx = btn.getAttribute('data-idx');
      const amt = parseInt(btn.getAttribute('data-amt'), 10);
      const code = btn.getAttribute('data-code');
      const cloudKey = btn.getAttribute('data-cloud-key');
      const cloudSource = btn.getAttribute('data-cloud-source');
      const actionType = btn.getAttribute('data-type');

      if (actionType === 'with-ok') {
        await CLOUD_SYNC.updateCloudWithdrawalStatus(cloudKey, cloudSource, code, 'Đã Chuyển Tiền');

        const user = AUTH.users[uname];
        if (user && user.withdrawals) {
          const wItem = user.withdrawals.find(item => item.code === code);
          if (wItem) wItem.status = 'Đã Chuyển Tiền';
          else if (user.withdrawals[idx]) user.withdrawals[idx].status = 'Đã Chuyển Tiền';
          AUTH.save();
        }

        await refreshAdminData();
        window.soundEngine.playWin();
        showToast(`✅ Đã xác nhận chuyển tiền thành công cho [${uname}]!`);
      } else {
        await CLOUD_SYNC.updateCloudWithdrawalStatus(cloudKey, cloudSource, code, 'Từ Chối');

        // Refund balance to user
        if (!AUTH.users[uname]) {
          const cu = await CLOUD_SYNC.getUser(uname);
          if (cu) AUTH.users[uname] = cu;
          else AUTH.users[uname] = { username: uname, balance: 0, vip: 1, deposits: [], withdrawals: [] };
        }

        const user = AUTH.users[uname];
        user.balance = (user.balance || 0) + amt;

        if (user.withdrawals) {
          const wItem = user.withdrawals.find(item => item.code === code);
          if (wItem) wItem.status = 'Từ Chối';
          else if (user.withdrawals[idx]) user.withdrawals[idx].status = 'Từ Chối';
        }

        AUTH.save();

        // Update refunded balance on cloud
        await CLOUD_SYNC.updateUserBalance(uname, user.balance);

        updateAuthHeaderUI();
        await refreshAdminData();
        window.soundEngine.playLoss();
        showToast(`❌ Đã hủy lệnh rút và hoàn trả ${formatMoney(amt)} ₫ cho [${uname}]!`);
      }
    });

    // Members list table buttons (Quick pump, drain, select)
    if (el.adminUserListBody) {
      el.adminUserListBody.addEventListener('click', async (e) => {
        const pumpBtn = e.target.closest('.btn-user-pump');
        const drainBtn = e.target.closest('.btn-user-drain');
        const pickBtn = e.target.closest('.btn-user-pick');

        if (pumpBtn) {
          const uname = pumpBtn.getAttribute('data-user');
          const amt = parseInt(pumpBtn.getAttribute('data-amt'), 10) || 100000;
          const u = AUTH.users[uname];
          if (u) {
            u.balance = (u.balance || 0) + amt;
            AUTH.save();
            await CLOUD_SYNC.updateUserBalance(uname, u.balance);
            updateAuthHeaderUI();
            await refreshAdminData();
            window.soundEngine.playJackpot();
            showToast(`➕ Đã bơm +${formatMoney(amt)} ₫ cho tài khoản [${uname}]!`);
          }
        } else if (drainBtn) {
          const uname = drainBtn.getAttribute('data-user');
          const amt = parseInt(drainBtn.getAttribute('data-amt'), 10) || 100000;
          const u = AUTH.users[uname];
          if (u) {
            u.balance = Math.max(0, (u.balance || 0) - amt);
            AUTH.save();
            await CLOUD_SYNC.updateUserBalance(uname, u.balance);
            updateAuthHeaderUI();
            await refreshAdminData();
            window.soundEngine.playLoss();
            showToast(`➖ Đã hút -${formatMoney(amt)} ₫ từ tài khoản [${uname}]!`);
          }
        } else if (pickBtn) {
          const uname = pickBtn.getAttribute('data-user');
          el.inflateUserSelect.value = uname;
          switchAdminTab('inflate');
          showToast(`👉 Đã chọn tài khoản [${uname}]. Nhập số tiền để bơm/hút!`);
        }
      });
    }

    // Inflation control buttons
    el.btnInflateAdd.addEventListener('click', async () => {
      const uname = el.inflateUserSelect.value;
      const amt = parseInt(el.inflateAmount.value, 10);
      if (!uname || isNaN(amt) || amt <= 0) return;

      const user = AUTH.users[uname];
      if (user) {
        user.balance += amt;
        AUTH.save();
        await CLOUD_SYNC.updateUserBalance(uname, user.balance);
        updateAuthHeaderUI();
        await refreshAdminData();
        window.soundEngine.playJackpot();
        showToast(`➕ BƠM TIỀN: Đã cộng +${formatMoney(amt)} ₫ vào tài khoản [${uname}]!`);
      }
    });

    el.btnInflateSub.addEventListener('click', async () => {
      const uname = el.inflateUserSelect.value;
      const amt = parseInt(el.inflateAmount.value, 10);
      if (!uname || isNaN(amt) || amt <= 0) return;

      const user = AUTH.users[uname];
      if (user) {
        user.balance = Math.max(0, user.balance - amt);
        AUTH.save();
        await CLOUD_SYNC.updateUserBalance(uname, user.balance);
        updateAuthHeaderUI();
        await refreshAdminData();
        window.soundEngine.playLoss();
        showToast(`➖ HÚT TIỀN: Đã trừ -${formatMoney(amt)} ₫ khỏi tài khoản [${uname}] để giảm lạm phát!`);
      }
    });

    // Secret Outcome Override buttons (Chỉ Nhà Cái điều khiển)
    el.btnOverrideTai.addEventListener('click', () => {
      STATE.adminOverride = 'tai';
      calculateNextRoundDice();
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.setCloudOverride('tai', STATE.nextDice);
      }
      updateAdminLiveBetsRadar();
      showToast('🔮 Đã ép kết quả tay tiếp theo ra TÀI!');
    });

    el.btnOverrideXiu.addEventListener('click', () => {
      STATE.adminOverride = 'xiu';
      calculateNextRoundDice();
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.setCloudOverride('xiu', STATE.nextDice);
      }
      updateAdminLiveBetsRadar();
      showToast('🔮 Đã ép kết quả tay tiếp theo ra XỈU!');
    });

    el.btnOverrideTriple.addEventListener('click', () => {
      STATE.adminOverride = 'triple';
      calculateNextRoundDice();
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.setCloudOverride('triple', STATE.nextDice);
      }
      updateAdminLiveBetsRadar();
      showToast('⚡ Đã ép tay tiếp theo NỔ BÃO (1 ĂN 100)!');
    });

    el.btnOverrideAuto.addEventListener('click', () => {
      STATE.adminOverride = null;
      calculateNextRoundDice();
      if (CLOUD_SYNC.isConnected()) {
        CLOUD_SYNC.clearCloudOverride();
      }
      updateAdminLiveBetsRadar();
      showToast('🔄 Đã chuyển về ngẫu nhiên tự nhiên (chu kỳ 50 ván 1 bão)!');
    });

    // Quick Override from PnL Projection Cards
    if (el.pnlCardTai) {
      el.pnlCardTai.addEventListener('click', () => {
        if (el.btnOverrideTai) el.btnOverrideTai.click();
      });
    }
    if (el.pnlCardXiu) {
      el.pnlCardXiu.addEventListener('click', () => {
        if (el.btnOverrideXiu) el.btnOverrideXiu.click();
      });
    }
    if (el.pnlCardBao) {
      el.pnlCardBao.addEventListener('click', () => {
        if (el.btnOverrideTriple) el.btnOverrideTriple.click();
      });
    }
  }

  // --- CLIPBOARD HELPER ---
  function setupCopyButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-copy');
      if (btn) {
        const text = btn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = '✓ Đã Chép!';
            showToast(`Đã sao chép: ${text}`);
            setTimeout(() => btn.textContent = original, 1800);
          }).catch(() => {
            showToast(`Sao chép: ${text}`);
          });
        }
      }
    });
  }

  // --- EVENT SETUP ---
  function setupEvents() {
    el.btnUserMenu.addEventListener('click', () => openAuthModal('login'));
    el.btnLogout.addEventListener('click', () => {
      AUTH.logout();
      updateAuthHeaderUI();
      renderUserHistoryTable();
      showToast('Đã đăng xuất tài khoản!');
      openAuthModal('login');
    });
    el.btnCloseAuth.addEventListener('click', closeAuthModal);
    el.tabBtnLogin.addEventListener('click', () => switchAuthTab('login'));
    el.tabBtnRegister.addEventListener('click', () => switchAuthTab('register'));

    // Login submit
    el.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = el.loginUsername.value;
      const p = el.loginPassword.value;
      showToast('⏳ Đang kiểm tra đăng nhập...');
      const res = await AUTH.login(u, p);
      if (res.success) {
        updateAuthHeaderUI();
        renderUserHistoryTable();
        closeAuthModal();
        window.soundEngine.playWin();
        if (AUTH.isAdmin()) {
          showToast(`👑 Xin chào Nhà Cái Tumiz! Quyền quản trị đã kích hoạt.`);
        } else {
          showToast(`Chào mừng trở lại, ${res.user.username}!`);
        }
      } else {
        showToast(res.message);
        window.soundEngine.playLoss();
      }
    });

    // Register submit
    el.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = el.regUsername.value;
      const p = el.regPassword.value;
      const pConfirm = el.regPasswordConfirm.value;

      if (p !== pConfirm) {
        showToast('Mật khẩu xác nhận không khớp!');
        return;
      }

      showToast('⏳ Đang tạo tài khoản trên hệ thống...');
      const res = await AUTH.register(u, p);
      if (res.success) {
        updateAuthHeaderUI();
        renderUserHistoryTable();
        closeAuthModal();
        window.soundEngine.playJackpot();
        showToast(`🎉 Đăng ký thành công! Kích hoạt đặc quyền: Hoàn tiền 100% vé cược đầu tiên nếu thua (khi cược từ 10.000 ₫ trở lên)!`, 4500);
      } else {
        showToast(res.message);
        window.soundEngine.playLoss();
      }
    });

    // Quick Guest button
    el.btnQuickGuest.addEventListener('click', async () => {
      const guestName = 'khach_' + Math.floor(1000 + Math.random() * 9000);
      await AUTH.register(guestName, '123456');
      updateAuthHeaderUI();
      renderUserHistoryTable();
      closeAuthModal();
      window.soundEngine.playWin();
      showToast(`Chơi với tài khoản khách: ${guestName}! Được hoàn tiền 100% vé cược đầu nếu thua (từ 10k)!`, 4500);
    });

    // Admin PIN Modal Verification
    if (el.adminPinForm) {
      el.adminPinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const entered = el.adminPinInput.value.trim();
        const tumizUser = AUTH.users['tumiz'];
        const realPwd = (tumizUser && tumizUser.password) ? tumizUser.password : 'tumiz888';

        if (entered === realPwd) {
          adminSessionUnlocked = true;
          el.adminPinModal.classList.remove('active');
          showAdminModalDirectly();
          window.soundEngine.playJackpot();
          showToast('🔓 Xác thực thành công! Đã mở Bảng Quản Trị Nhà Cái.');
        } else {
          window.soundEngine.playLoss();
          showToast('❌ Mật khẩu Nhà Cái không chính xác!');
          el.adminPinInput.value = '';
          el.adminPinInput.focus();
        }
      });
    }

    if (el.btnCloseAdminPin) {
      el.btnCloseAdminPin.addEventListener('click', () => {
        if (el.adminPinModal) el.adminPinModal.classList.remove('active');
      });
    }
    if (el.adminPinBackdrop) {
      el.adminPinBackdrop.addEventListener('click', () => {
        if (el.adminPinModal) el.adminPinModal.classList.remove('active');
      });
    }

    // Admin Change Password Form
    if (el.adminChangePwdForm) {
      el.adminChangePwdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const oldPwd = el.oldAdminPwd.value;
        const newPwd = el.newAdminPwd.value;
        const newPwdConfirm = el.newAdminPwdConfirm.value;

        const tumizUser = AUTH.users['tumiz'];
        if (!tumizUser) return;

        if (oldPwd !== tumizUser.password) {
          showToast('❌ Mật khẩu hiện tại không chính xác!');
          window.soundEngine.playLoss();
          return;
        }
        if (newPwd.length < 4) {
          showToast('❌ Mật khẩu mới phải từ 4 ký tự trở lên!');
          return;
        }
        if (newPwd !== newPwdConfirm) {
          showToast('❌ Mật khẩu xác nhận không khớp!');
          return;
        }

        tumizUser.password = newPwd;
        AUTH.save();
        el.adminChangePwdForm.reset();
        window.soundEngine.playWin();
        showToast('🎉 ĐÃ ĐỔI MẬT KHẨU NHÀ CÁI THÀNH CÔNG! Hãy ghi nhớ mật khẩu mới.');
      });
    }

    // Cloud Database Settings & Actions
    if (el.btnSaveCloudDb) {
      el.btnSaveCloudDb.addEventListener('click', () => {
        const url = (el.cloudDbUrl.value || '').trim();
        localStorage.setItem('tx_cloud_db_url', url);
        window.soundEngine.playChip();
        showToast('💾 Đã lưu cấu hình Firebase Cloud Database!');
        refreshAdminData();
      });
    }

    if (el.btnTestCloudSync) {
      el.btnTestCloudSync.addEventListener('click', async () => {
        const testDep = {
          code: `TEST_${Math.floor(1000 + Math.random() * 9000)}`,
          username: 'test_friend',
          amount: 50000,
          bank: 'BIDV',
          stk: '8860252059',
          time: new Date().toLocaleTimeString('vi-VN'),
          status: 'Chờ Duyệt'
        };
        showToast('⏳ Đang bắn lệnh nạp test lên Đám Mây...');
        await CLOUD_SYNC.pushDeposit(testDep);
        await refreshAdminData();
        window.soundEngine.playJackpot();
        showToast('✅ Đã bắn lệnh test thành công! Hãy xem danh sách duyệt nạp.');
      });
    }

    if (el.btnForceSyncCloud) {
      el.btnForceSyncCloud.addEventListener('click', async () => {
        showToast('🔄 Đang đồng bộ dữ liệu từ Đám Mây...');
        await refreshAdminData();
        showToast('✅ Đồng bộ đám mây hoàn tất!');
      });
    }

    if (el.tabBtnAdminSecurity) {
      el.tabBtnAdminSecurity.addEventListener('click', () => switchAdminTab('security'));
    }
    if (el.tabBtnAdminCloud) {
      el.tabBtnAdminCloud.addEventListener('click', () => switchAdminTab('cloud'));
    }

    // 8XBET Advertisement Modal events
    const close8xbet = () => {
      if (el.ad8xbetModal) el.ad8xbetModal.classList.remove('active');
    };

    const open8xbet = () => {
      if (el.ad8xbetModal) el.ad8xbetModal.classList.add('active');
    };

    if (el.btnClose8xbetAd) el.btnClose8xbetAd.addEventListener('click', close8xbet);
    if (el.btnDismiss8xbet) el.btnDismiss8xbet.addEventListener('click', close8xbet);
    if (el.ad8xbetBackdrop) el.ad8xbetBackdrop.addEventListener('click', close8xbet);
    if (el.btnOpen8xbetAd) el.btnOpen8xbetAd.addEventListener('click', open8xbet);
    if (el.btnJoin8xbet) {
      el.btnJoin8xbet.addEventListener('click', () => {
        close8xbet();
        showToast('⚽ Đang kết nối tới trang cá cược bóng đá 8XBET - Đối tác Manchester City...');
      });
    }

    // First Bet Refund Modal close
    if (el.btnCloseRefundModal) {
      el.btnCloseRefundModal.addEventListener('click', () => {
        if (el.firstBetRefundModal) el.firstBetRefundModal.classList.remove('active');
      });
    }

    // Quick test deposit button in deposit modal
    if (el.btnQuickTestDeposit) {
      el.btnQuickTestDeposit.addEventListener('click', () => {
        const user = AUTH.getUser();
        if (!user) {
          showToast('Vui lòng đăng nhập trước khi nạp thử nghiệm!');
          openAuthModal('login');
          return;
        }
        user.balance += 50000;
        if (!user.deposits) user.deposits = [];
        user.deposits.unshift({
          code: 'NAP TEST50K',
          amount: 50000,
          bank: 'TEST THỬ NGHIỆM',
          stk: '-',
          time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
          status: 'Thành Công'
        });
        AUTH.save();
        updateAuthHeaderUI();
        closeDepositModal();
        window.soundEngine.playChip();
        showToast('✅ Đã nạp thử nghiệm +50.000 ₫! Bạn có thể cược 20.000 ₫ ngay để test tính năng hoàn tiền!');
      });
    }

    // Deposit Modal events
    el.btnOpenDeposit.addEventListener('click', openDepositModal);
    el.btnCloseDeposit.addEventListener('click', closeDepositModal);
    el.tabBtnCreateDep.addEventListener('click', () => switchDepositTab('create'));
    el.tabBtnDepHistory.addEventListener('click', () => switchDepositTab('history'));

    document.querySelectorAll('.btn-quick-amt').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-quick-amt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        el.customAmount.value = btn.getAttribute('data-amt');
        window.soundEngine.playChip();
      });
    });

    el.btnGenerateBill.addEventListener('click', generateDepositBill);
    el.btnBackStep1.addEventListener('click', resetDepositStep1);
    el.btnConfirmTransfer.addEventListener('click', submitDepositRequestToAdmin);

    // Withdraw Modal events
    el.btnOpenWithdraw.addEventListener('click', openWithdrawModal);
    el.btnCloseWithdraw.addEventListener('click', closeWithdrawModal);
    el.tabBtnCreateWithdraw.addEventListener('click', () => switchWithdrawTab('create'));
    el.tabBtnWithdrawHistory.addEventListener('click', () => switchWithdrawTab('history'));
    el.withdrawForm.addEventListener('submit', submitWithdrawRequest);

    document.querySelectorAll('.btn-quick-withdraw').forEach(btn => {
      if (btn.id === 'btnWithdrawAll') {
        btn.addEventListener('click', () => {
          const user = AUTH.getUser();
          if (user) el.withdrawAmount.value = user.balance;
        });
      } else {
        btn.addEventListener('click', () => {
          el.withdrawAmount.value = btn.getAttribute('data-amt');
        });
      }
    });

    // Admin Dashboard events
    el.btnOpenAdmin.addEventListener('click', openAdminModal);
    el.btnCloseAdmin.addEventListener('click', closeAdminModal);
    el.tabBtnAdminDep.addEventListener('click', () => switchAdminTab('dep'));
    el.tabBtnAdminWithdraw.addEventListener('click', () => switchAdminTab('withdraw'));
    if (el.tabBtnAdminUsers) el.tabBtnAdminUsers.addEventListener('click', () => switchAdminTab('users'));
    el.tabBtnAdminInflate.addEventListener('click', () => switchAdminTab('inflate'));
    el.btnRefreshDep.addEventListener('click', refreshAdminData);
    el.btnRefreshWithdraw.addEventListener('click', refreshAdminData);
    if (el.btnRefreshUsers) el.btnRefreshUsers.addEventListener('click', refreshAdminData);
    setupAdminDelegations();

    // Mode & sound toggles
    el.soundToggleBtn.addEventListener('click', () => {
      const active = window.soundEngine.toggleSound();
      el.btnSound.textContent = active ? '🔊' : '🔇';
      showToast(active ? 'Đã bật âm thanh' : 'Đã tắt âm thanh');
    });

    el.btnMode.addEventListener('click', () => {
      STATE.nanBatEnabled = !STATE.nanBatEnabled;
      el.modeText.textContent = STATE.nanBatEnabled ? '⚡ Nặn Bát: BẬT' : '🚀 Nặn Bát: TẮT';
      showToast(STATE.nanBatEnabled ? 'Đã bật chế độ Nặn Bát' : 'Đã chuyển sang chế độ Mở Nhanh');
    });

    el.btnQuickOpen.addEventListener('click', () => {
      if (STATE.isRevealing) finishRound();
    });

    // Chips selection
    el.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        STATE.currentChip = parseInt(chip.getAttribute('data-value'), 10);
        window.soundEngine.playChip();
      });
    });

    // Bet spot click
    el.betSpots.forEach(spot => {
      spot.addEventListener('click', () => {
        const betType = spot.getAttribute('data-bet');
        placeBet(betType);
      });
    });

    // Betting utility buttons
    el.btnDouble.addEventListener('click', doubleBets);
    el.btnAllIn.addEventListener('click', allInBet);
    el.btnClearBet.addEventListener('click', clearAllBets);

    // Win Modal close
    el.btnCloseWinModal.addEventListener('click', () => {
      el.winModal.classList.remove('active');
    });
    if (el.winModal) {
      el.winModal.addEventListener('click', (e) => {
        if (e.target === el.winModal) {
          el.winModal.classList.remove('active');
        }
      });
    }
    if (el.firstBetRefundModal) {
      el.firstBetRefundModal.addEventListener('click', (e) => {
        if (e.target === el.firstBetRefundModal) {
          el.firstBetRefundModal.classList.remove('active');
        }
      });
    }

    setupCopyButtons();

    window.addEventListener('click', () => {
      window.soundEngine.ensureContext();
    }, { once: true });
  }

  // --- INITIALIZATION ---
  function init() {
    AUTH.load();
    loadPersistedData();
    updateAuthHeaderUI();
    updateBetDisplays();
    setupEvents();
    initBowlDrag();

    // Initial 3D dice display: 5 - 5 - 1 = 11 (Tài)
    position3DDice(1, 5);
    position3DDice(2, 5);
    position3DDice(3, 1);

    // Start session timer
    startSessionTimer();

    // Background polling for players to receive deposit approval, balance sync, and withdrawal status
    setInterval(async () => {
      const user = AUTH.getUser();
      if (!user || AUTH.isAdmin()) return;

      // 1. Sync live balance from cloud (in case Admin pumped/drained money or approved deposit)
      if (CLOUD_SYNC.isConnected()) {
        try {
          const cloudUser = await CLOUD_SYNC.getUser(user.username);
          if (cloudUser && cloudUser.balance !== undefined && cloudUser.balance !== user.balance) {
            const diff = cloudUser.balance - user.balance;
            user.balance = Number(cloudUser.balance);
            AUTH.save();
            updateAuthHeaderUI();
            if (diff > 0) {
              window.soundEngine.playJackpot();
              showToast(`🎉 Nhà Cái Tumiz đã cộng +${formatMoney(diff)} ₫ vào tài khoản của bạn!`, 5000);
            }
          }
        } catch (e) {}
      }

      // 2. Check pending deposits
      const pendingDep = (user.deposits || []).find(d => d.status === 'Chờ Duyệt');
      if (pendingDep) {
        try {
          const cloudDeps = await CLOUD_SYNC.fetchCloudDeposits();
          const match = cloudDeps.find(cd => cd.code === pendingDep.code);
          if (match && match.status === 'Thành Công') {
            pendingDep.status = 'Thành Công';
            user.balance += pendingDep.amount;
            AUTH.save();
            updateAuthHeaderUI();
            renderDepositHistoryTable();
            window.soundEngine.playJackpot();
            showToast(`🎉 Lệnh nạp tiền +${formatMoney(pendingDep.amount)} ₫ (${pendingDep.code}) đã được Nhà Cái Tumiz DUYỆT THÀNH CÔNG!`, 6000);
          } else if (match && match.status === 'Từ Chối') {
            pendingDep.status = 'Từ Chối';
            AUTH.save();
            renderDepositHistoryTable();
            window.soundEngine.playLoss();
            showToast(`❌ Lệnh nạp tiền (${pendingDep.code}) đã bị từ chối!`, 5000);
          }
        } catch (e) {}
      }

      // 3. Check pending withdrawals
      const pendingWith = (user.withdrawals || []).find(w => w.status === 'Chờ Admin Chuyển Tiền');
      if (pendingWith) {
        try {
          const cloudWiths = await CLOUD_SYNC.fetchCloudWithdrawals();
          const match = cloudWiths.find(cw => cw.code === pendingWith.code);
          if (match && match.status === 'Đã Chuyển Tiền') {
            pendingWith.status = 'Đã Chuyển Tiền';
            AUTH.save();
            renderWithdrawHistoryTable();
            window.soundEngine.playWin();
            showToast(`🎉 Lệnh rút tiền ${formatMoney(pendingWith.amount)} ₫ (${pendingWith.code}) đã được Nhà Cái Tumiz chuyển khoản thành công vào STK của bạn!`, 6000);
          } else if (match && match.status === 'Từ Chối') {
            pendingWith.status = 'Từ Chối';
            user.balance += pendingWith.amount;
            AUTH.save();
            updateAuthHeaderUI();
            renderWithdrawHistoryTable();
            window.soundEngine.playLoss();
            showToast(`❌ Lệnh rút tiền (${pendingWith.code}) bị từ chối. Số tiền ${formatMoney(pendingWith.amount)} ₫ đã được hoàn trả lại ví!`, 6000);
          }
        } catch (e) {}
      }
    }, 2800);

    // Auto-refresh for Admin Dashboard when open so incoming requests and live bets appear live
    setInterval(async () => {
      if (el.adminModal && el.adminModal.classList.contains('active')) {
        await refreshAdminData();
        await updateAdminLiveBetsRadar();
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
