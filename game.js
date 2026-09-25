/* ==========================================================================
   TÀI XỈU VIP CASINO - GAME ENGINE & AUTH & BIDV DEPOSIT (8860252059)
   Rules:
     - 3 xúc xắc 3D 6 mặt (1 - 6 mỗi con)
     - Tổng điểm >= 11: TÀI (1 ăn 2)
     - Tổng điểm <= 10: XỈU (1 ăn 2)
     - Bão: 3 xúc xắc có số điểm bằng nhau (1 ăn 30)
     - Cược Chẵn / Lẻ theo tổng điểm (1 ăn 1.95)
     - Multi-user authentication & BIDV VietQR Banking deposit
   ========================================================================== */

(function () {
  'use strict';

  // --- MULTI-USER AUTH STATE ---
  const AUTH = {
    currentUser: null,
    users: {}, // { username: { username, password, balance, vip, deposits: [], history: [] } }

    load() {
      try {
        const stored = localStorage.getItem('tx_vip_auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.users = parsed.users || {};
          this.currentUser = parsed.currentUser || null;
        }
      } catch (e) {
        console.warn('Cannot load auth', e);
      }

      // Default demo account if none exists
      if (!this.users['demo'] && Object.keys(this.users).length === 0) {
        this.users['demo'] = {
          username: 'demo',
          password: '123',
          balance: 500000,
          vip: 1,
          deposits: [
            {
              code: 'NAP TX8892',
              amount: 500000,
              bank: 'BIDV',
              stk: '8860252059',
              time: new Date().toLocaleTimeString('vi-VN'),
              status: 'Thành Công'
            }
          ],
          history: []
        };
      }

      if (!this.currentUser || !this.users[this.currentUser]) {
        this.currentUser = 'demo';
      }
    },

    save() {
      try {
        localStorage.setItem('tx_vip_auth', JSON.stringify({
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

    register(username, password) {
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

      // Create new user with 100,000 starter bonus
      this.users[username] = {
        username: username,
        password: password,
        balance: 100000,
        vip: 1,
        deposits: [
          {
            code: 'BONUS TANTHU',
            amount: 100000,
            bank: 'HỆ THỐNG',
            stk: '-',
            time: new Date().toLocaleTimeString('vi-VN'),
            status: 'Thành Công'
          }
        ],
        history: []
      };

      this.currentUser = username;
      this.save();
      return { success: true, user: this.users[username] };
    },

    login(username, password) {
      username = username.trim().toLowerCase();
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
    timeLeft: 15,
    timerInterval: null,
    isRolling: false,
    isRevealing: false,
    currentDice: [1, 2, 3],
    bets: {
      tai: 0,
      xiu: 0,
      triple: 0,
      even: 0,
      odd: 0
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
    // Deposit state
    pendingDeposit: {
      amount: 200000,
      code: 'NAP TX8892'
    }
  };

  // 3D Cube Base Rotations for Faces 1 to 6
  // (In our 3D geometry: Face 1 Front, Face 2 Top, Face 3 Right, Face 4 Left, Face 5 Bottom, Face 6 Back)
  const BASE_FACE_ROTATIONS = {
    1: { rx: 0,   ry: 0 },
    2: { rx: -90, ry: 0 },
    3: { rx: 0,   ry: -90 },
    4: { rx: 0,   ry: 90 },
    5: { rx: 90,  ry: 0 },
    6: { rx: 0,   ry: 180 }
  };

  // Realistic resting 3D isometric tilt angles for the 3 individual dice
  const DICE_TILTS = [
    { x: -22, y: 24, z: -4 },  // Dice 1
    { x: -26, y: -20, z: 6 },  // Dice 2
    { x: -18, y: 30, z: -8 }   // Dice 3
  ];

  let cumulativeSpins = [0, 0, 0];

  // --- DOM ELEMENTS ---
  const el = {
    // Header & User info
    displayUsername: document.getElementById('displayUsername'),
    displayVip: document.getElementById('displayVip'),
    btnLogout: document.getElementById('btnLogout'),
    btnUserMenu: document.getElementById('btnUserMenu'),
    userBalance: document.getElementById('userBalance'),
    btnOpenDeposit: document.getElementById('btnOpenDeposit'),
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
    bowlControls: document.getElementById('bowlControls'),
    btnQuickOpen: document.getElementById('btnQuickOpen'),
    resultBanner: document.getElementById('resultBanner'),
    scoreBreakdown: document.getElementById('scoreBreakdown'),
    totalScore: document.getElementById('totalScore'),
    winnerTitle: document.getElementById('winnerTitle'),

    // Bet spots
    totalBetTai: document.getElementById('totalBetTai'),
    totalBetXiu: document.getElementById('totalBetXiu'),
    userCountTai: document.getElementById('userCountTai'),
    userCountXiu: document.getElementById('userCountXiu'),
    myBetTaiVal: document.getElementById('myBetTaiVal'),
    myBetXiuVal: document.getElementById('myBetXiuVal'),
    myBetTripleVal: document.getElementById('myBetTripleVal'),
    myBetEven: document.getElementById('myBetEven'),
    myBetOdd: document.getElementById('myBetOdd'),

    // Control buttons
    btnRollNow: document.getElementById('btnRollNow'),
    btnDouble: document.getElementById('btnDouble'),
    btnAllIn: document.getElementById('btnAllIn'),
    btnClearBet: document.getElementById('btnClearBet'),
    chips: document.querySelectorAll('.chip'),
    betSpots: document.querySelectorAll('.bet-spot, .bet-spot-mini'),

    // Soi Cau & History
    beadRoad: document.getElementById('beadRoad'),
    statTaiCount: document.getElementById('statTaiCount'),
    statTaiPct: document.getElementById('statTaiPct'),
    statXiuCount: document.getElementById('statXiuCount'),
    statXiuPct: document.getElementById('statXiuPct'),
    statTripleCount: document.getElementById('statTripleCount'),
    historyBody: document.getElementById('historyBody'),
    winRateBadge: document.getElementById('winRateBadge'),

    // Toast & Win Modal
    toast: document.getElementById('toast'),
    winModal: document.getElementById('winModal'),
    winModalTitle: document.getElementById('winModalTitle'),
    winModalAmount: document.getElementById('winModalAmount'),
    winModalDetail: document.getElementById('winModalDetail'),
    btnCloseWinModal: document.getElementById('btnCloseWinModal'),

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

    // Deposit Modal (BIDV 8860252059)
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

    // Check Transaction Modal
    checkTxModal: document.getElementById('checkTxModal'),
    txProgressFill: document.getElementById('txProgressFill'),
    checkTxTitle: document.getElementById('checkTxTitle'),
    checkTxDesc: document.getElementById('checkTxDesc')
  };

  // --- FORMATTING HELPERS ---
  function formatMoney(num) {
    return Number(num).toLocaleString('vi-VN');
  }

  function showToast(msg, duration = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, duration);
  }

  // --- USER PROFILE & BALANCE UI ---
  function updateAuthHeaderUI() {
    const user = AUTH.getUser();
    if (user) {
      el.displayUsername.textContent = user.username;
      el.displayVip.textContent = `VIP ${user.vip || 1}`;
      el.userBalance.textContent = formatMoney(user.balance);
      el.btnLogout.style.display = 'block';
    } else {
      el.displayUsername.textContent = 'Chưa Đăng Nhập';
      el.displayVip.textContent = 'GUEST';
      el.userBalance.textContent = '0';
      el.btnLogout.style.display = 'none';
    }
  }

  function updateBetDisplays() {
    el.myBetTaiVal.textContent = formatMoney(STATE.bets.tai) + ' ₫';
    el.myBetXiuVal.textContent = formatMoney(STATE.bets.xiu) + ' ₫';
    el.myBetTripleVal.textContent = formatMoney(STATE.bets.triple) + ' ₫';
    el.myBetEven.textContent = formatMoney(STATE.bets.even) + ' ₫';
    el.myBetOdd.textContent = formatMoney(STATE.bets.odd) + ' ₫';

    el.totalBetTai.textContent = formatMoney(STATE.simulatedBets.tai + STATE.bets.tai) + ' ₫';
    el.totalBetXiu.textContent = formatMoney(STATE.simulatedBets.xiu + STATE.bets.xiu) + ' ₫';
    el.userCountTai.textContent = STATE.simulatedBets.taiUsers + (STATE.bets.tai > 0 ? 1 : 0);
    el.userCountXiu.textContent = STATE.simulatedBets.xiuUsers + (STATE.bets.xiu > 0 ? 1 : 0);
  }

  // --- 3D 6-FACE DICE ENGINE ---
  function position3DDice(diceIndex, faceValue) {
    const diceEl = el[`dice${diceIndex}`];
    const base = BASE_FACE_ROTATIONS[faceValue] || { rx: 0, ry: 0 };
    const tilt = DICE_TILTS[diceIndex - 1];

    // Add 2-3 full 360 degree spins per roll
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

    if (user.balance < STATE.currentChip) {
      showToast('Số dư không đủ! Bấm Nạp Tiền qua BIDV để nạp thêm.');
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

    let target = 'tai';
    if (STATE.bets.xiu > STATE.bets.tai) target = 'xiu';

    const amount = user.balance;
    STATE.bets[target] += amount;
    user.balance = 0;

    AUTH.save();
    window.soundEngine.playChip();
    updateAuthHeaderUI();
    updateBetDisplays();
    showToast(`🔥 ĐÃ ALL-IN ${formatMoney(amount)} ₫ vào ${target.toUpperCase()}!`);
  }

  // --- SESSION & ROLLING ENGINE ---
  function startSessionTimer() {
    clearInterval(STATE.timerInterval);
    STATE.timeLeft = 15;
    el.timerLabel.textContent = 'ĐẶT CƯỢC';
    el.gameStatus.textContent = 'Đang nhận cược...';
    el.gameStatus.className = 'status-badge';
    el.resultBanner.classList.remove('show');

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

      // Audio tick last 5 seconds
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

  function triggerRoll() {
    if (STATE.isRolling || STATE.isRevealing) return;
    clearInterval(STATE.timerInterval);

    STATE.isRolling = true;
    el.timerLabel.textContent = 'LẮC BÁT';
    el.gameStatus.textContent = 'Đang lắc 3 xúc xắc 3D...';
    el.gameStatus.className = 'status-badge rolling';
    el.resultBanner.classList.remove('show');

    // Generate random 1 - 6 for 3 dice
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const d3 = Math.floor(Math.random() * 6) + 1;
    STATE.currentDice = [d1, d2, d3];

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
        STATE.isRevealing = true;
        el.gameStatus.textContent = 'Nặn Bát để xem kết quả!';
        el.gameStatus.className = 'status-badge revealing';
        el.btnQuickOpen.style.display = 'inline-block';
      } else {
        finishRound();
      }
    }, 1250);
  }

  function finishRound() {
    STATE.isRevealing = false;
    el.btnQuickOpen.style.display = 'none';

    // Slide bowl off smoothly
    window.soundEngine.playBowlOpen();
    el.bowlOverlay.style.transition = 'transform 0.45s ease-out, opacity 0.45s';
    el.bowlOverlay.style.transform = 'translate(0px, -240px)';
    setTimeout(() => {
      el.bowlOverlay.classList.remove('active');
      el.bowlOverlay.style.transition = '';
      el.bowlOverlay.style.transform = 'translate(0px, 0px)';
    }, 500);

    // Evaluate Result
    const [d1, d2, d3] = STATE.currentDice;
    const total = d1 + d2 + d3;
    const isTriple = (d1 === d2 && d2 === d3);
    const isTai = total >= 11;
    const isEven = (total % 2 === 0);
    const winner = isTai ? 'TAI' : 'XIU';

    // Update Result Banner
    el.scoreBreakdown.textContent = `${d1} + ${d2} + ${d3}`;
    el.totalScore.textContent = total;
    el.winnerTitle.textContent = isTriple ? `BÃO ${d1} - ${winner}` : winner;
    el.winnerTitle.className = `winner-title ${winner.toLowerCase()}`;
    el.resultBanner.classList.add('show');

    // Calculate Payouts for Current User
    const user = AUTH.getUser();
    let totalBet = 0;
    let netWin = 0;
    const betItems = [];

    if (user) {
      // TÀI / XỈU (1:1)
      if (STATE.bets.tai > 0) {
        totalBet += STATE.bets.tai;
        betItems.push(`Tài: ${formatMoney(STATE.bets.tai)} ₫`);
        if (isTai) {
          netWin += STATE.bets.tai;
          user.balance += STATE.bets.tai * 2;
        } else {
          netWin -= STATE.bets.tai;
        }
      }

      if (STATE.bets.xiu > 0) {
        totalBet += STATE.bets.xiu;
        betItems.push(`Xỉu: ${formatMoney(STATE.bets.xiu)} ₫`);
        if (!isTai) {
          netWin += STATE.bets.xiu;
          user.balance += STATE.bets.xiu * 2;
        } else {
          netWin -= STATE.bets.xiu;
        }
      }

      // BÃO (1:30)
      if (STATE.bets.triple > 0) {
        totalBet += STATE.bets.triple;
        betItems.push(`Bão: ${formatMoney(STATE.bets.triple)} ₫`);
        if (isTriple) {
          const tripleWin = STATE.bets.triple * 30;
          netWin += tripleWin;
          user.balance += STATE.bets.triple + tripleWin;
        } else {
          netWin -= STATE.bets.triple;
        }
      }

      // CHẴN / LẺ (1:1.95)
      if (STATE.bets.even > 0) {
        totalBet += STATE.bets.even;
        betItems.push(`Chẵn: ${formatMoney(STATE.bets.even)} ₫`);
        if (isEven) {
          const winAmt = Math.floor(STATE.bets.even * 0.95);
          netWin += winAmt;
          user.balance += STATE.bets.even + winAmt;
        } else {
          netWin -= STATE.bets.even;
        }
      }

      if (STATE.bets.odd > 0) {
        totalBet += STATE.bets.odd;
        betItems.push(`Lẻ: ${formatMoney(STATE.bets.odd)} ₫`);
        if (!isEven) {
          const winAmt = Math.floor(STATE.bets.odd * 0.95);
          netWin += winAmt;
          user.balance += STATE.bets.odd + winAmt;
        } else {
          netWin -= STATE.bets.odd;
        }
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
        betSummary: betItems.join(' | ')
      };

      if (!user.history) user.history = [];
      user.history.unshift(historyEntry);
      AUTH.save();
    }

    // Record to global history
    STATE.globalHistory.unshift({
      id: STATE.sessionId,
      dice: [d1, d2, d3],
      total,
      winner,
      isTriple
    });

    STATE.sessionId++;
    el.sessionId.textContent = `#${STATE.sessionId}`;

    updateAuthHeaderUI();
    recalcStats();

    // Reset bets
    Object.keys(STATE.bets).forEach(k => STATE.bets[k] = 0);
    updateBetDisplays();

    // Sound & Popups
    if (netWin > 0) {
      if (isTriple) {
        window.soundEngine.playJackpot();
      } else {
        window.soundEngine.playWin();
      }

      if (netWin >= 1000000) {
        showWinModal(netWin, `${total} điểm - ${winner} [${d1}, ${d2}, ${d3}]`);
      } else {
        showToast(`🎉 THẮNG CƯỢC: +${formatMoney(netWin)} ₫!`);
      }
    } else if (totalBet > 0 && netWin < 0) {
      window.soundEngine.playLoss();
      showToast(`Vận may sẽ đến ở phiên sau! (-${formatMoney(Math.abs(netWin))} ₫)`);
    }

    el.gameStatus.textContent = `Kết quả: ${total} (${winner}) - Chuẩn bị ván mới`;
    setTimeout(() => {
      startSessionTimer();
    }, 5500);
  }

  function showWinModal(amount, detail) {
    el.winModalTitle.textContent = amount >= 10000000 ? '👑 ĐẠI THẮNG VIP!' : '✨ THẮNG LỚN! ✨';
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

  function renderRoadMap() {
    el.beadRoad.innerHTML = '';
    const recent = STATE.globalHistory.slice(-30);

    recent.forEach(item => {
      const bead = document.createElement('div');
      bead.className = `bead ${item.winner.toLowerCase()}`;
      bead.textContent = item.winner === 'TAI' ? 'T' : 'X';
      if (item.isTriple) {
        bead.className = 'bead triple';
        bead.textContent = 'B';
      }
      bead.title = `Phiên #${item.id}: [${item.dice.join(', ')}] = ${item.total} (${item.winner})`;
      el.beadRoad.appendChild(bead);
    });

    const total = STATE.stats.taiCount + STATE.stats.xiuCount;
    const taiPct = total > 0 ? Math.round((STATE.stats.taiCount / total) * 100) : 50;
    const xiuPct = total > 0 ? 100 - taiPct : 50;

    el.statTaiCount.textContent = STATE.stats.taiCount;
    el.statTaiPct.textContent = taiPct + '%';
    el.statXiuCount.textContent = STATE.stats.xiuCount;
    el.statXiuPct.textContent = xiuPct + '%';
    el.statTripleCount.textContent = STATE.stats.tripleCount;
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
      const outcomeClass = item.netWin > 0 ? 'win-text' : (item.netWin < 0 ? 'loss-text' : '');
      const outcomeSign = item.netWin > 0 ? '+' : '';
      const outcomeText = item.netWin === 0 ? 'Hòa' : `${outcomeSign}${formatMoney(item.netWin)} ₫`;

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
  let isDraggingBowl = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;

  function initBowlDrag() {
    const bowl = el.bowlOverlay;

    bowl.addEventListener('pointerdown', (e) => {
      if (!STATE.isRevealing) return;
      isDraggingBowl = true;
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
      bowl.classList.add('dragging');
      bowl.setPointerCapture(e.pointerId);
    });

    bowl.addEventListener('pointermove', (e) => {
      if (!isDraggingBowl || !STATE.isRevealing) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      bowl.style.transform = `translate(${currentX}px, ${currentY}px)`;
      const dist = Math.hypot(currentX, currentY);

      if (dist > 120) {
        isDraggingBowl = false;
        bowl.classList.remove('dragging');
        finishRound();
        currentX = 0; currentY = 0;
      }
    });

    const stopDrag = () => {
      if (!isDraggingBowl) return;
      isDraggingBowl = false;
      bowl.classList.remove('dragging');

      const dist = Math.hypot(currentX, currentY);
      if (dist > 80) {
        finishRound();
        currentX = 0; currentY = 0;
      } else {
        bowl.style.transition = 'transform 0.3s ease-out';
        bowl.style.transform = 'translate(0px, 0px)';
        currentX = 0; currentY = 0;
        setTimeout(() => bowl.style.transition = '', 300);
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
    accountName: 'BIDV CASINO VIP'
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

    // Unique random transfer code: NAP TX + 4 digits
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const transferCode = `NAP TX${randomCode}`;

    STATE.pendingDeposit = {
      amount: amt,
      code: transferCode
    };

    // Update Step 2 Bill Details
    el.billAmountDisplay.textContent = formatMoney(amt) + ' ₫';
    el.billMemoDisplay.textContent = transferCode;
    document.getElementById('btnCopyAmt').setAttribute('data-copy', amt);
    document.getElementById('btnCopyMemo').setAttribute('data-copy', transferCode);

    // Generate VietQR URL for BIDV STK 8860252059
    // Standard Napas 247 VietQR URL format:
    const encodedMemo = encodeURIComponent(transferCode);
    const encodedName = encodeURIComponent(BIDV_BANK.accountName);
    const vietQrUrl = `https://img.vietqr.io/image/bidv-${BIDV_BANK.accountNumber}-compact2.png?amount=${amt}&addInfo=${encodedMemo}&accountName=${encodedName}`;

    el.vietQrImg.src = vietQrUrl;

    // Switch view to Step 2
    el.depositStep1.classList.add('hidden');
    el.depositStep2.classList.remove('hidden');
    window.soundEngine.playChip();
  }

  function confirmDepositTransfer() {
    const user = AUTH.getUser();
    if (!user) return;

    const { amount, code } = STATE.pendingDeposit;

    // Open Check Tx Modal
    el.checkTxTitle.textContent = 'Đang Kiểm Tra Giao Dịch BIDV...';
    el.checkTxDesc.innerHTML = `Hệ thống đang kết nối cổng BIDV với số tài khoản <strong>${BIDV_BANK.accountNumber}</strong> để đối soát nội dung: <strong>${code}</strong>...`;
    el.txProgressFill.style.width = '0%';
    el.checkTxModal.classList.add('active');

    // Simulate bank gateway verification progress (3 seconds)
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      el.txProgressFill.style.width = `${progress}%`;

      if (progress >= 100) {
        clearInterval(interval);

        setTimeout(() => {
          // Success! Add balance to user
          user.balance += amount;

          // Save transaction to user deposit history
          if (!user.deposits) user.deposits = [];
          user.deposits.unshift({
            code: code,
            amount: amount,
            bank: 'BIDV',
            stk: BIDV_BANK.accountNumber,
            time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
            status: 'Thành Công'
          });

          AUTH.save();
          updateAuthHeaderUI();

          // Close check modal and deposit modal
          el.checkTxModal.classList.remove('active');
          closeDepositModal();

          // Celebration
          window.soundEngine.playJackpot();
          showToast(`🎉 NẠP THÀNH CÔNG: +${formatMoney(amount)} ₫ vào tài khoản!`, 3500);
        }, 500);
      }
    }, 250);
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

    el.depositHistoryBody.innerHTML = user.deposits.map(d => `
      <tr>
        <td><strong>${d.code}</strong></td>
        <td class="win-text">+${formatMoney(d.amount)} ₫</td>
        <td>${d.bank} (${d.stk})</td>
        <td><code>${d.code}</code></td>
        <td>${d.time}</td>
        <td><span class="badge-success" style="color: #34d399; font-weight:800;">✅ ${d.status}</span></td>
      </tr>
    `).join('');
  }

  // Copy to clipboard helper
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

  // --- EVENT LISTENERS ---
  function setupEvents() {
    // Auth open / close
    el.btnUserMenu.addEventListener('click', () => {
      openAuthModal('login');
    });

    el.btnLogout.addEventListener('click', () => {
      AUTH.logout();
      updateAuthHeaderUI();
      renderUserHistoryTable();
      showToast('Đã đăng xuất tài khoản!');
      openAuthModal('login');
    });

    el.btnCloseAuth.addEventListener('click', closeAuthModal);

    // Auth tab buttons
    el.tabBtnLogin.addEventListener('click', () => switchAuthTab('login'));
    el.tabBtnRegister.addEventListener('click', () => switchAuthTab('register'));

    // Login submit
    el.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = el.loginUsername.value;
      const p = el.loginPassword.value;
      const res = AUTH.login(u, p);
      if (res.success) {
        updateAuthHeaderUI();
        renderUserHistoryTable();
        closeAuthModal();
        window.soundEngine.playWin();
        showToast(`Xin chào mừng, ${res.user.username}!`);
      } else {
        showToast(res.message);
        window.soundEngine.playLoss();
      }
    });

    // Register submit
    el.registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = el.regUsername.value;
      const p = el.regPassword.value;
      const pConfirm = el.regPasswordConfirm.value;

      if (p !== pConfirm) {
        showToast('Mật khẩu xác nhận không khớp!');
        return;
      }

      const res = AUTH.register(u, p);
      if (res.success) {
        updateAuthHeaderUI();
        renderUserHistoryTable();
        closeAuthModal();
        window.soundEngine.playJackpot();
        showToast(`🎉 Đăng ký thành công! Bạn nhận được +100.000 ₫ tân thủ!`, 3000);
      } else {
        showToast(res.message);
        window.soundEngine.playLoss();
      }
    });

    // Quick Guest Button
    el.btnQuickGuest.addEventListener('click', () => {
      const guestName = 'khach_' + Math.floor(1000 + Math.random() * 9000);
      AUTH.register(guestName, '123456');
      updateAuthHeaderUI();
      renderUserHistoryTable();
      closeAuthModal();
      window.soundEngine.playWin();
      showToast(`Chơi với tài khoản: ${guestName} (+100K vốn)!`);
    });

    // Deposit Modal open / close
    el.btnOpenDeposit.addEventListener('click', openDepositModal);
    el.btnCloseDeposit.addEventListener('click', closeDepositModal);
    el.tabBtnCreateDep.addEventListener('click', () => switchDepositTab('create'));
    el.tabBtnDepHistory.addEventListener('click', () => switchDepositTab('history'));

    // Deposit Quick Amounts
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
    el.btnConfirmTransfer.addEventListener('click', confirmDepositTransfer);

    // Sound toggle
    el.soundToggleBtn.addEventListener('click', () => {
      const active = window.soundEngine.toggleSound();
      el.btnSound.textContent = active ? '🔊' : '🔇';
      showToast(active ? 'Đã bật âm thanh' : 'Đã tắt âm thanh');
    });

    // Mode toggle (Nặn Bát)
    el.btnMode.addEventListener('click', () => {
      STATE.nanBatEnabled = !STATE.nanBatEnabled;
      el.modeText.textContent = STATE.nanBatEnabled ? '⚡ Nặn Bát: BẬT' : '🚀 Nặn Bát: TẮT';
      showToast(STATE.nanBatEnabled ? 'Đã bật chế độ Nặn Bát' : 'Đã chuyển sang chế độ Mở Nhanh');
    });

    // Quick open bowl
    el.btnQuickOpen.addEventListener('click', () => {
      if (STATE.isRevealing) {
        finishRound();
      }
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

    // Betting Utility buttons
    el.btnRollNow.addEventListener('click', () => {
      if (STATE.isRolling || STATE.isRevealing) return;
      triggerRoll();
    });

    el.btnDouble.addEventListener('click', doubleBets);
    el.btnAllIn.addEventListener('click', allInBet);
    el.btnClearBet.addEventListener('click', clearAllBets);

    // Win Modal close
    el.btnCloseWinModal.addEventListener('click', () => {
      el.winModal.classList.remove('active');
    });

    // Clipboard copy buttons
    setupCopyButtons();

    // Initial audio context on first click
    window.addEventListener('click', () => {
      window.soundEngine.ensureContext();
    }, { once: true });
  }

  // --- INITIALIZATION ---
  function init() {
    AUTH.load();
    updateAuthHeaderUI();
    updateBetDisplays();
    setupEvents();
    initBowlDrag();

    // Initial 3D dice display: 3 - 4 - 5
    position3DDice(1, 3);
    position3DDice(2, 4);
    position3DDice(3, 5);

    // Initial session countdown
    startSessionTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
