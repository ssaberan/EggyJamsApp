export const DEFAULT_CUSTOM_SCRIPT = `
// ─── Chess: Player (White) vs AI (Black, depth-2 minimax) ───

// Piece codes: 1=pawn 2=knight 3=bishop 4=rook 5=queen 6=king
// Positive = white, negative = black, 0 = empty
const P=1,N=2,B=3,R=4,Q=5,K=6;
const PIECE_CHAR = {
  [P]:'\u2659',[N]:'\u2658',[B]:'\u2657',[R]:'\u2656',[Q]:'\u2655',[K]:'\u2654',
  [-P]:'\u265F',[-N]:'\u265E',[-B]:'\u265D',[-R]:'\u265C',[-Q]:'\u265B',[-K]:'\u265A'
};
const PIECE_VAL = { [P]:100,[N]:320,[B]:330,[R]:500,[Q]:900,[K]:20000 };

// Piece-square tables (white perspective, index 0 = a8)
const PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0
];
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20
];
const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];
const PST = { [P]:PST_PAWN,[N]:PST_KNIGHT,[B]:PST_BISHOP,[R]:PST_ROOK,[Q]:PST_QUEEN,[K]:PST_KING };

// ─── State ───
const initBoard = () => [
  [-R,-N,-B,-Q,-K,-B,-N,-R],
  [-P,-P,-P,-P,-P,-P,-P,-P],
  [ 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0],
  [ P, P, P, P, P, P, P, P],
  [ R, N, B, Q, K, B, N, R],
];

let board = initBoard();
let turn = 1; // 1 = white, -1 = black
let selected = null; // {r,c}
let legalMovesForSelected = [];
let castling = { wk:true, wq:true, bk:true, bq:true };
let enPassant = null; // {r,c} target square
let gameOver = false;
let statusText = "Your turn (White)";
let aiTimer = null;

// ─── Helpers ───
const inBounds = (r,c) => r>=0 && r<8 && c>=0 && c<8;
const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
const cloneBoard = b => b.map(r => [...r]);

function findKing(bd, color) {
  const k = color * K;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (bd[r][c]===k) return {r,c};
  return null;
}

function isAttacked(bd, r, c, byColor) {
  // Check knight attacks
  for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr=r+dr, nc=c+dc;
    if (inBounds(nr,nc) && bd[nr][nc] === byColor*N) return true;
  }
  // Check pawn attacks
  const pd = byColor === 1 ? 1 : -1; // direction pawns attack FROM
  for (const dc of [-1,1]) {
    const nr=r+pd, nc=c+dc;
    if (inBounds(nr,nc) && bd[nr][nc] === byColor*P) return true;
  }
  // Check king attacks
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
    if (dr===0&&dc===0) continue;
    const nr=r+dr,nc=c+dc;
    if (inBounds(nr,nc) && bd[nr][nc] === byColor*K) return true;
  }
  // Check sliding attacks (bishop/queen diagonals, rook/queen lines)
  const slides = [
    {dirs:[[-1,-1],[-1,1],[1,-1],[1,1]], pieces:[B,Q]},
    {dirs:[[-1,0],[1,0],[0,-1],[0,1]], pieces:[R,Q]}
  ];
  for (const {dirs,pieces} of slides) {
    for (const [dr,dc] of dirs) {
      let nr=r+dr,nc=c+dc;
      while (inBounds(nr,nc)) {
        const p = bd[nr][nc];
        if (p !== 0) {
          if (sign(p) === byColor && pieces.includes(Math.abs(p))) return true;
          break;
        }
        nr+=dr; nc+=dc;
      }
    }
  }
  return false;
}

function inCheck(bd, color) {
  const kp = findKing(bd, color);
  return kp ? isAttacked(bd, kp.r, kp.c, -color) : false;
}

// ─── Move generation ───
function pseudoMoves(bd, color, cst, ep) {
  const moves = [];
  const add = (fr,fc,tr,tc,flags) => moves.push({fr,fc,tr,tc,flags:flags||0});
  const CASTLING=1, EN_PASSANT=2, PROMOTION=4;

  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = bd[r][c];
    if (sign(p) !== color) continue;
    const type = Math.abs(p);

    if (type === P) {
      const dir = color === 1 ? -1 : 1;
      const startRow = color === 1 ? 6 : 1;
      const promoRow = color === 1 ? 0 : 7;
      // Forward
      if (inBounds(r+dir,c) && bd[r+dir][c]===0) {
        if (r+dir === promoRow) add(r,c,r+dir,c,PROMOTION);
        else add(r,c,r+dir,c);
        // Double push
        if (r===startRow && bd[r+2*dir][c]===0) add(r,c,r+2*dir,c);
      }
      // Captures
      for (const dc of [-1,1]) {
        const nr=r+dir, nc=c+dc;
        if (!inBounds(nr,nc)) continue;
        if (bd[nr][nc]!==0 && sign(bd[nr][nc])===-color) {
          if (nr===promoRow) add(r,c,nr,nc,PROMOTION);
          else add(r,c,nr,nc);
        }
        // En passant
        if (ep && ep.r===nr && ep.c===nc) add(r,c,nr,nc,EN_PASSANT);
      }
    }
    else if (type === N) {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr=r+dr,nc=c+dc;
        if (inBounds(nr,nc) && sign(bd[nr][nc])!==color) add(r,c,nr,nc);
      }
    }
    else if (type === K) {
      for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
        if (dr===0&&dc===0) continue;
        const nr=r+dr,nc=c+dc;
        if (inBounds(nr,nc) && sign(bd[nr][nc])!==color) add(r,c,nr,nc);
      }
      // Castling
      if (color===1) {
        if (cst.wk && bd[7][5]===0 && bd[7][6]===0 && bd[7][7]===R
            && !isAttacked(bd,7,4,-1) && !isAttacked(bd,7,5,-1) && !isAttacked(bd,7,6,-1))
          add(7,4,7,6,CASTLING);
        if (cst.wq && bd[7][1]===0 && bd[7][2]===0 && bd[7][3]===0 && bd[7][0]===R
            && !isAttacked(bd,7,4,-1) && !isAttacked(bd,7,3,-1) && !isAttacked(bd,7,2,-1))
          add(7,4,7,2,CASTLING);
      } else {
        if (cst.bk && bd[0][5]===0 && bd[0][6]===0 && bd[0][7]===-R
            && !isAttacked(bd,0,4,1) && !isAttacked(bd,0,5,1) && !isAttacked(bd,0,6,1))
          add(0,4,0,6,CASTLING);
        if (cst.bq && bd[0][1]===0 && bd[0][2]===0 && bd[0][3]===0 && bd[0][0]===-R
            && !isAttacked(bd,0,4,1) && !isAttacked(bd,0,3,1) && !isAttacked(bd,0,2,1))
          add(0,4,0,2,CASTLING);
      }
    }
    else {
      // Sliding pieces (B, R, Q)
      const dirs = type===B ? [[-1,-1],[-1,1],[1,-1],[1,1]]
                 : type===R ? [[-1,0],[1,0],[0,-1],[0,1]]
                 : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr,dc] of dirs) {
        let nr=r+dr,nc=c+dc;
        while (inBounds(nr,nc)) {
          const t = bd[nr][nc];
          if (t===0) { add(r,c,nr,nc); }
          else { if (sign(t)===-color) add(r,c,nr,nc); break; }
          nr+=dr; nc+=dc;
        }
      }
    }
  }
  return moves;
}

function applyMove(bd, m, cst, ep) {
  const nb = cloneBoard(bd);
  const nc = {...cst};
  let nep = null;
  const piece = nb[m.fr][m.fc];

  nb[m.tr][m.tc] = piece;
  nb[m.fr][m.fc] = 0;

  // En passant capture
  if (m.flags & 2) {
    nb[m.fr][m.tc] = 0;
  }
  // Promotion (always queen)
  if (m.flags & 4) {
    nb[m.tr][m.tc] = sign(piece) * Q;
  }
  // Castling rook move
  if (m.flags & 1) {
    if (m.tc === 6) { nb[m.tr][5] = nb[m.tr][7]; nb[m.tr][7] = 0; }
    if (m.tc === 2) { nb[m.tr][3] = nb[m.tr][0]; nb[m.tr][0] = 0; }
  }
  // Update castling rights
  if (Math.abs(piece)===K) {
    if (sign(piece)===1) { nc.wk=false; nc.wq=false; }
    else { nc.bk=false; nc.bq=false; }
  }
  if (m.fr===7&&m.fc===0) nc.wq=false;
  if (m.fr===7&&m.fc===7) nc.wk=false;
  if (m.fr===0&&m.fc===0) nc.bq=false;
  if (m.fr===0&&m.fc===7) nc.bk=false;
  if (m.tr===7&&m.tc===0) nc.wq=false;
  if (m.tr===7&&m.tc===7) nc.wk=false;
  if (m.tr===0&&m.tc===0) nc.bq=false;
  if (m.tr===0&&m.tc===7) nc.bk=false;

  // En passant target
  if (Math.abs(piece)===P && Math.abs(m.tr-m.fr)===2) {
    nep = { r:(m.fr+m.tr)/2, c:m.fc };
  }

  return { board:nb, castling:nc, enPassant:nep };
}

function legalMoves(bd, color, cst, ep) {
  return pseudoMoves(bd, color, cst, ep).filter(m => {
    const after = applyMove(bd, m, cst, ep);
    return !inCheck(after.board, color);
  });
}

// ─── AI evaluation ───
function evaluate(bd) {
  let score = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = bd[r][c];
    if (p===0) continue;
    const abs = Math.abs(p);
    const s = sign(p);
    const idx = s===1 ? r*8+c : (7-r)*8+c;
    score += s * (PIECE_VAL[abs] + (PST[abs]?PST[abs][idx]:0));
  }
  return score;
}

function minimax(bd, color, cst, ep, depth, alpha, beta) {
  const moves = legalMoves(bd, color, cst, ep);
  if (moves.length === 0) {
    return inCheck(bd, color) ? (color === 1 ? -99999 : 99999) : 0;
  }
  if (depth === 0) return evaluate(bd);

  if (color === 1) {
    let best = -Infinity;
    for (const m of moves) {
      const after = applyMove(bd, m, cst, ep);
      const val = minimax(after.board, -1, after.castling, after.enPassant, depth-1, alpha, beta);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const after = applyMove(bd, m, cst, ep);
      const val = minimax(after.board, 1, after.castling, after.enPassant, depth-1, alpha, beta);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function aiMove() {
  const moves = legalMoves(board, -1, castling, enPassant);
  if (moves.length === 0) return null;
  let bestVal = Infinity;
  let bestMove = moves[0];
  for (const m of moves) {
    const after = applyMove(board, m, castling, enPassant);
    const val = minimax(after.board, 1, after.castling, after.enPassant, 1, -Infinity, Infinity);
    if (val < bestVal) { bestVal = val; bestMove = m; }
  }
  return bestMove;
}

// ─── Apply move & check game state ───
function doMove(m) {
  const after = applyMove(board, m, castling, enPassant);
  board = after.board;
  castling = after.castling;
  enPassant = after.enPassant;
  turn = -turn;

  const moves = legalMoves(board, turn, castling, enPassant);
  if (moves.length === 0) {
    gameOver = true;
    if (inCheck(board, turn)) {
      statusText = turn === 1 ? 'Checkmate — Black wins!' : 'Checkmate — White wins!';
    } else {
      statusText = 'Stalemate — Draw!';
    }
  } else if (inCheck(board, turn)) {
    statusText = (turn === 1 ? 'White' : 'Black') + ' is in check!';
  } else {
    statusText = turn === 1 ? 'Your turn (White)' : 'AI is thinking...';
  }
}

// ─── Rendering ───
const style = document.createElement('style');
style.textContent = \`
  .chess-root { display:flex; flex-direction:column; align-items:center; gap:12px; user-select:none; font-family:system-ui,sans-serif; }
  .chess-board { display:grid; grid-template-columns:repeat(8,1fr); border:2px solid #a0804080; border-radius:4px; overflow:hidden; }
  .chess-sq { width:clamp(40px,8vmin,72px); height:clamp(40px,8vmin,72px); display:flex; align-items:center; justify-content:center;
              font-size:clamp(24px,5.5vmin,52px); cursor:pointer; position:relative; transition:background .1s; }
  .chess-sq.light { background:#f0d9b5; }
  .chess-sq.dark  { background:#b58863; }
  .chess-sq.selected { background:#f6f669 !important; }
  .chess-sq.move-target::after { content:''; position:absolute; width:28%; height:28%; border-radius:50%; background:rgba(0,0,0,0.25); }
  .chess-sq.capture-target { background:rgba(255,80,80,0.45) !important; }
  .chess-sq.last-from, .chess-sq.last-to { background:rgba(155,199,0,0.45) !important; }
  .chess-status { color:#e2e8f0; font-size:15px; font-weight:600; min-height:24px; text-align:center; }
  .chess-btns { display:flex; gap:10px; }
  .chess-btn { padding:8px 20px; border-radius:8px; border:none; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; }
  .chess-btn-resign { background:#ef4444; color:white; }
  .chess-btn-resign:hover { background:#dc2626; }
  .chess-btn-continue { background:#6366f1; color:white; }
  .chess-btn-continue:hover { background:#4f46e5; }
  .chess-btn-restart { background:#334155; color:#e2e8f0; }
  .chess-btn-restart:hover { background:#475569; }
  .chess-piece-white { color: #fff; text-shadow: 0 0 2px rgba(0,0,0,0.7); }
  .chess-piece-black { color: #1a1a2e; text-shadow: 0 0 2px rgba(255,255,255,0.3); }
\`;
container.appendChild(style);

const root = document.createElement('div');
root.className = 'chess-root';
container.appendChild(root);

const statusEl = document.createElement('div');
statusEl.className = 'chess-status';
root.appendChild(statusEl);

const boardEl = document.createElement('div');
boardEl.className = 'chess-board';
root.appendChild(boardEl);

const squares = [];
for (let r=0;r<8;r++) {
  squares[r] = [];
  for (let c=0;c<8;c++) {
    const sq = document.createElement('div');
    sq.className = 'chess-sq ' + ((r+c)%2===0 ? 'light' : 'dark');
    sq.addEventListener('click', () => onSquareClick(r,c));
    boardEl.appendChild(sq);
    squares[r][c] = sq;
  }
}

const btnsEl = document.createElement('div');
btnsEl.className = 'chess-btns';
root.appendChild(btnsEl);

let lastMove = null;

function render() {
  statusEl.textContent = statusText;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const sq = squares[r][c];
    const p = board[r][c];
    sq.textContent = p !== 0 ? PIECE_CHAR[p] : '';
    sq.className = 'chess-sq ' + ((r+c)%2===0 ? 'light' : 'dark');
    if (p !== 0) {
      sq.classList.add(sign(p) === 1 ? 'chess-piece-white' : 'chess-piece-black');
    }
    if (selected && selected.r===r && selected.c===c) sq.classList.add('selected');
    if (lastMove) {
      if (lastMove.fr===r && lastMove.fc===c) sq.classList.add('last-from');
      if (lastMove.tr===r && lastMove.tc===c) sq.classList.add('last-to');
    }
  }
  // Show legal move targets
  for (const m of legalMovesForSelected) {
    const sq = squares[m.tr][m.tc];
    if (board[m.tr][m.tc] !== 0 || (m.flags & 2)) sq.classList.add('capture-target');
    else sq.classList.add('move-target');
  }
  // Buttons
  btnsEl.innerHTML = '';
  if (gameOver) {
    const cb = document.createElement('button');
    cb.className = 'chess-btn chess-btn-continue';
    cb.textContent = 'Continue';
    cb.onclick = () => api.onComplete();
    btnsEl.appendChild(cb);
    const rb = document.createElement('button');
    rb.className = 'chess-btn chess-btn-restart';
    rb.textContent = 'Play Again';
    rb.onclick = restartGame;
    btnsEl.appendChild(rb);
  } else {
    const rb = document.createElement('button');
    rb.className = 'chess-btn chess-btn-resign';
    rb.textContent = 'Resign';
    rb.onclick = () => api.onComplete();
    btnsEl.appendChild(rb);
  }
}

function onSquareClick(r, c) {
  if (gameOver || turn !== 1) return;
  const p = board[r][c];

  // If a piece is selected
  if (selected) {
    const move = legalMovesForSelected.find(m => m.tr===r && m.tc===c);
    if (move) {
      lastMove = move;
      doMove(move);
      selected = null;
      legalMovesForSelected = [];
      render();
      if (!gameOver) {
        aiTimer = setTimeout(doAiMove, 200);
      }
      return;
    }
  }

  // Select own piece
  if (sign(p) === 1) {
    selected = {r,c};
    legalMovesForSelected = legalMoves(board, 1, castling, enPassant).filter(m => m.fr===r && m.fc===c);
  } else {
    selected = null;
    legalMovesForSelected = [];
  }
  render();
}

function doAiMove() {
  if (gameOver || turn !== -1) return;
  const m = aiMove();
  if (m) {
    lastMove = m;
    doMove(m);
  }
  selected = null;
  legalMovesForSelected = [];
  render();
}

function restartGame() {
  board = initBoard();
  turn = 1;
  selected = null;
  legalMovesForSelected = [];
  castling = { wk:true, wq:true, bk:true, bq:true };
  enPassant = null;
  gameOver = false;
  lastMove = null;
  statusText = 'Your turn (White)';
  render();
}

// Cleanup AI timer on scene exit
api.onCleanup(() => { if (aiTimer) clearTimeout(aiTimer); });

render();
`;
