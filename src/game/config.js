// src/game/config.js — extracted from main.js
import { ASSET } from '../ui/assets.js';

export const LETTER_SYMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'W', 'S'];
export const MYSTERY_FILE = 'trojan-horse-mystery.webp';
export const SYMBOL_PACKS = {
  classic: { id: 'classic', label: 'Classic', base: ASSET },
  artNew:  { id: 'artNew',  label: 'Art New', base: ASSET + 'art-new/' },
};
export const DEFAULT_SYMBOL_PACK = 'artNew';

export const SYMBOLS = {
  A: { img: ASSET + 'A.webp', name: 'Master Hacker', type: 'high', pays: [0,0,0.75,1.00,1.50] },
  B: { img: ASSET + 'B.webp', name: 'AI Core', type: 'high', pays: [0,0,0.50,0.75,1.00] },
  C: { img: ASSET + 'C.webp', name: 'VR Headset', type: 'high', pays: [0,0,0.50,0.75,1.00] },
  D: { img: ASSET + 'D.webp', name: 'Recon Drone', type: 'high', pays: [0,0,0.25,0.50,0.75] },
  E: { img: ASSET + 'E.webp', name: 'EMP Gun', type: 'high', pays: [0,0,0.25,0.50,0.75] },
  F: { img: ASSET + 'F.webp', name: 'Bitcoin', type: 'low', pays: [0,0,0.20,0.40,0.60] },
  G: { img: ASSET + 'G.webp', name: 'Terminal', type: 'low', pays: [0,0,0.20,0.40,0.60] },
  H: { img: ASSET + 'H.webp', name: 'Code', type: 'low', pays: [0,0,0.15,0.30,0.50] },
  I: { img: ASSET + 'I.webp', name: 'Ethereum', type: 'low', pays: [0,0,0.10,0.20,0.50] },
  K: { img: ASSET + 'K.webp', name: 'Microchip', type: 'low', pays: [0,0,0.10,0.20,0.50] },
  W: { img: ASSET + 'W.webp', name: 'Wild', type: 'wild', pays: [0,0,0,0,0] },
  S: { img: ASSET + 'S.webp', name: 'Scatter', type: 'scatter', pays: [0,0,0,0,0] },
  M: { img: ASSET + MYSTERY_FILE, name: 'Mystery', type: 'mystery', pays: [0,0,0,0,0] },
};

export const PAYING = ['A','B','C','D','E','F','G','H','I','K'];
export const LOWS = ['F','G','H','I','K'];
export const HIGHS = ['A','B','C','D','E'];
export const REELS = 5, ROWS = 3;
export const WIN_CAP = 19693;
export const REF_BET = 1;

export const BET_LEVELS = {
  low: [0.20,0.40,0.60,0.80,1.00,1.20,1.60],
  med: [2.00,2.40,2.80,3.20,3.60,4.00,5.00,6.00,8.00,10.00,14.00,18.00,24.00,32.00],
  high: [40.00,60.00,80.00,100.00],
};
export const ALL_BETS = [...BET_LEVELS.low, ...BET_LEVELS.med, ...BET_LEVELS.high];

/**
 * Giải thích tiếng Việt — ngắn, dễ hiểu (dùng cho mode 📖 Feature Explain).
 * nameVi: tên gọi dễ nhớ · what: feature sẽ làm gì · how: cách ảnh hưởng tiền/grid.
 */
export const FEATURE_EXPLAIN_VI = {
  corehack: {
    nameVi: 'Lõi lượng tử (Core Hack)',
    what: 'Jackpot cố định 4 tier: USER 15×, GHOST 50×, ELITE 500×, GOD 19693× Total Bet.',
    how: 'RNG trước khi spin xong. Trúng thì tắt 12 mini-feature. Pick 15 node, match-3 để nhận giải.',
    see: 'Quantum Core phát sáng, kết nối Mainframe, rồi mở lưới 15 Encrypted Nodes.',
  },
  firewall: {
    nameVi: 'Tường lửa (Firewall Block)',
    what: 'Chặn 1–2 loại biểu tượng thấp (low) ra khỏi vòng quay lần này.',
    how: 'Các biểu tượng đó khó (hoặc không) xuất hiện trên lưới → lưới “sạch” low hơn, dễ ra biểu tượng cao hơn.',
    see: 'Tường lửa đỏ bốc từ dưới lưới, “đốt” các biểu tượng thấp.',
  },
  decrypt: {
    nameVi: 'Giải mã dữ liệu (Data Decrypt)',
    what: 'Chọn 1–2 ô đang là biểu tượng thấp và đổi thành biểu tượng cao.',
    how: 'Sau khi quay dừng, low → high trên lưới → có thể tạo thêm cách thắng (ways).',
    see: 'Lưới laser xanh quét qua, ô low biến thành high.',
  },
  trojan: {
    nameVi: 'Ngựa Trojan (Trojan Horse)',
    what: 'Thả 3–6 “hộp bí ẩn” (Mystery) xuống các ô ngẫu nhiên, rồi cùng lúc mở ra cùng một biểu tượng.',
    how: 'Nhiều ô biến thành cùng 1 symbol → dễ ăn ways dài / nhiều ô trùng.',
    see: 'Hộp/ngựa rơi xuống ô → nổ ra cùng một biểu tượng.',
  },
  overload: {
    nameVi: 'Quá tải dữ liệu (Data Overload)',
    what: 'Nếu cột nào có Wild, cả cột đó biến thành full Wild.',
    how: 'Wild thay thế hầu hết symbol khi tính ways → cột full Wild rất mạnh cho chuỗi thắng.',
    see: 'Tia điện từ Wild lan cả cột, cột sáng full Wild.',
  },
  overclock: {
    nameVi: 'Ép xung hệ thống (System Overclock)',
    what: 'Chọn 1 loại biểu tượng đang trả thưởng và dán cùng một hệ số ×3 / ×5 / ×8 / ×10 lên các ô đó.',
    how: 'Tiền ways của symbol đó được nhân thêm (một lần theo luật game, không nhân dồn theo từng ô).',
    see: 'Nhãn ×3/×5/×8/×10 đóng dấu cam lên các ô được chọn.',
  },
  cloning: {
    nameVi: 'Nhân bản dữ liệu (Data Cloning)',
    what: 'Chọn 1 loại biểu tượng và “tách đôi” (Split ×2) mọi ô cùng loại đó.',
    how: 'Mỗi ô split đếm như 2 symbol khi tính 243-ways → số ways / win tăng.',
    see: 'Biểu tượng rung, nhiễu bóng rồi tách đôi (hiện ×2).',
  },
  root: {
    nameVi: 'Quyền root (Root Access)',
    what: 'Chọn 1–3 cột (reel) và tách đôi (Split) gần như mọi ô trên các cột đó (trừ Scatter).',
    how: 'Nhiều ô ×2 trên cả cột → ways mạnh hơn rõ rệt.',
    see: 'Mưa code xanh (Matrix) đổ xuống 1–3 cột, ô bị tách đôi.',
  },
  surge: {
    nameVi: 'Xung điện (Power Surge)',
    what: 'Biến 1–2 loại biểu tượng thành Wild, rồi lan sóng làm các ô kế bên bị Split (tách đôi).',
    how: 'Vừa có thêm Wild, vừa có thêm split quanh đó → lưới “nổ” theo hướng thắng.',
    see: 'Sét giáng xuống → Wild, sóng xung kích tách các ô kề.',
  },
  glitch: {
    nameVi: 'Lỗi hệ thống (System Glitch)',
    what: 'Xáo trộn chỗ các biểu tượng không nằm trong chuỗi thắng (Scatter giữ nguyên).',
    how: 'Có thể “ghép lại” lưới sau khi đã biết win — chỉ đổi chỗ rác, không xóa win đã có trên logic server.',
    see: 'Lưới giật lag, sọc nhiễu; xong thì các ô “rác” đã đổi chỗ.',
  },
  scan: {
    nameVi: 'Quét thuật toán (Algorithmic Scan)',
    what: 'Khóa 1–3 ô biểu tượng trả thưởng thường trên lưới và biến chúng thành Wild.',
    how: 'Thêm Wild tại các ô bị khóa → ways dễ nối dài và trúng nhiều hơn.',
    see: 'Radar/hồng tâm khóa từng ô rồi ô đó thành Wild.',
  },
  bandwidth: {
    nameVi: 'Nhân băng thông (Bandwidth Multiplier)',
    what: 'Gán một hệ số nhân toàn cục ×3 / ×5 / ×8 / ×10 cho tổng tiền thắng của spin này.',
    how: 'Sau khi tính ways xong, toàn bộ win của spin được nhân thêm (server đã nhân sẵn trên số tiền trả).',
    see: 'Thanh loading băng thông giữa màn, kéo tới mức ×3/×5/×8/×10.',
  },
  bypass: {
    nameVi: 'Bypass hai chiều (Bypass Protocol)',
    what: 'Bật tính tiền cả hai hướng: Trái→Phải và Phải→Trái.',
    how: 'Ngoài ways bình thường (L→R), còn cộng thêm ways ngược (R→L) → tổng win có thể gấp phần hai chiều.',
    see: 'Mũi tên luồng dữ liệu chạy hai chiều Trái↔Phải.',
  },
};

/** Feature Meter slot #1 (GDD §8.2). Not in FEATURES — never RNG-picked with the 12 minis. */
export const CORE_HACK = {
  id: 'corehack',
  name: 'Core Hack',
  color: '#00ff88',
  timing: 'pre',
  img: ASSET + 'quantum-core.webp',
  timingLabel: 'Before reels settle',
  desc: 'Fixed jackpot: USER 15× / GHOST 50× / ELITE 500× / GOD 19693× Total Bet. Disables the 12 mini-features on the same spin.',
  vfx: 'Quantum Core glows and connects to the Mainframe, then 15 Encrypted Nodes appear.',
};

export const FEATURES = [
  {
    id: 'firewall', name: 'Firewall Block', color: '#ff3355', timing: 'spin', img: ASSET + 'firewall-block.webp',
    timingLabel: 'During spin',
    desc: 'Blocks 1–2 random low-paying symbols so they cannot land on the reels this spin.',
    vfx: 'Red firewall rises from below the grid and burns low symbols off the screen.',
  },
  {
    id: 'decrypt', name: 'Data Decrypt', color: '#00f0ff', timing: 'post', img: ASSET + 'data-decrypt.webp',
    timingLabel: 'After reels stop',
    desc: 'Picks 1–2 low-paying types present on the grid (F/G/H/I/K). Every cell of a chosen type becomes the same high symbol.',
    vfx: 'Cyan laser scan decrypts each chosen low type into one high symbol.',
  },
  {
    id: 'trojan', name: 'Trojan Horse', color: '#aa44ff', timing: 'post', img: ASSET + 'trojan-horse.webp',
    timingLabel: 'After reels stop',
    desc: 'Places 3–6 Mystery symbols. After the spin they all reveal as the same paying symbol.',
    vfx: 'Encrypted packages drop onto cells, then explode into matching symbols.',
  },
  {
    id: 'overload', name: 'Data Overload', color: '#ff8800', timing: 'post', img: ASSET + 'data-everload.webp',
    timingLabel: 'After reels stop',
    desc: 'Any reel that contains a Wild expands so the entire reel becomes Wild. No effect if no Wild is present.',
    vfx: 'Electric surge spreads from Wild and lights the full column.',
  },
  {
    id: 'overclock', name: 'System Overclock', color: '#ff8800', timing: 'post', img: ASSET + 'system-overclock.webp',
    timingLabel: 'After reels stop',
    desc: 'Chooses one paying symbol type and applies the same random multiplier (×3 / ×5 / ×8 / ×10) to all of them on the grid.',
    vfx: 'Orange overclock labels stamp ×N onto the chosen symbols.',
  },
  {
    id: 'cloning', name: 'Data Cloning', color: '#00ff88', timing: 'post', img: ASSET + 'data-cloning.webp',
    timingLabel: 'After reels stop',
    desc: 'Chooses one paying symbol type and splits every matching cell into a Split Symbol (counts as 2 in ways).',
    vfx: 'Symbols glitch and divide like digital mitosis.',
  },
  {
    id: 'root', name: 'Root Access', color: '#00ff88', timing: 'post', img: ASSET + 'root-access.webp',
    timingLabel: 'After reels stop',
    desc: 'Selects 1–3 reels and splits every symbol on those reels (except Scatters).',
    vfx: 'Green matrix rain floods the chosen reels and splits symbols.',
  },
  {
    id: 'surge', name: 'Power Surge', color: '#ffff00', timing: 'post', img: ASSET + 'power-surge.webp',
    timingLabel: 'After reels stop',
    desc: 'Picks 1–2 paying types present on the grid and converts every matching cell into Wild. All 8 adjacent cells (including diagonals, except Scatters) become Split Symbols.',
    vfx: 'Lightning strikes symbols into Wilds; shockwave splits the 8 neighboring cells.',
  },
  {
    id: 'glitch', name: 'System Glitch', color: '#aa44ff', timing: 'post', img: ASSET + 'system-glitch.webp',
    timingLabel: 'After reels stop',
    desc: 'Shuffles all non-winning symbols on the grid (Scatters stay). Multipliers and symbol size are kept.',
    vfx: 'Grid glitch/noise, then non-win symbols swap places.',
  },
  {
    id: 'scan', name: 'Algorithmic Scan', color: '#00f0ff', timing: 'post', img: ASSET + 'algorithmic-scan.webp',
    timingLabel: 'After reels stop',
    desc: 'Locks onto 1–3 paying symbol types and turns all of them into Wilds.',
    vfx: 'Radar target lock paints symbols, then they become Wild.',
  },
  {
    id: 'bypass', name: 'Bypass Protocol', color: '#00f0ff', timing: 'win', img: ASSET + 'bypass-protocal.webp',
    timingLabel: 'Win phase',
    desc: 'Unlocks Right-to-Left pays in addition to Left-to-Right. Total win is the sum of both directions.',
    vfx: 'Data-flow arrows show both L→R and R→L evaluation.',
  },
  {
    id: 'bandwidth', name: 'Bandwidth Multiplier', color: '#ff8800', timing: 'win', img: ASSET + 'bandwidth-multiplier%20.webp',
    timingLabel: 'Win phase',
    desc: 'Applies a random global win multiplier (×3 / ×5 / ×8 / ×10) to all wins of this spin.',
    vfx: 'Bandwidth loading bar ramps to the chosen multiplier.',
  },
];

export const JACKPOT_TIERS = [
  { name: 'USER', mult: 15, emoji: '👤' },
  { name: 'GHOST', mult: 50, emoji: '👻' },
  { name: 'ELITE', mult: 500, emoji: '⭐' },
  { name: 'GOD', mult: 19693, emoji: '🔱' },
];
export const JACKPOT_CORE_IMG = ASSET + 'quantum-core-jackpot.webp';

export const REEL_STRIPS = [
  ['F','G','H','I','K','A','B','F','G','S','H','C','D','F','G','I','K','E','F','G','H','W','I','K','B','F','G','H','A','C'],
  ['F','G','H','I','K','B','C','F','G','H','D','I','K','E','F','G','S','H','I','K','A','F','G','W','H','I','K','C','D','F'],
  ['F','G','H','I','K','C','D','F','G','H','E','I','K','A','F','G','S','H','I','K','B','F','G','W','H','I','K','D','E','F'],
  ['F','G','H','I','K','D','E','F','G','H','A','I','K','B','F','G','S','H','I','K','C','F','G','W','H','I','K','A','B','F'],
  ['F','G','H','I','K','E','A','F','G','H','B','I','K','C','F','G','S','H','I','K','D','F','G','W','H','I','K','E','A','F'],
];

/** Server symbol id → client key. 13 = MYSTERY (TrojanHorse intermediate only). */
export const SYM_MAP = { 1:'A',2:'B',3:'C',4:'D',5:'E',6:'F',7:'G',8:'H',9:'I',10:'K',11:'W',12:'S',13:'M' };
export const SYM_TO_ID = Object.fromEntries(Object.entries(SYM_MAP).map(([id, k]) => [k, Number(id)]));
