export const PLATFORMER_SHOOTER_SCRIPT = `
// ─── Platformer Shooter: Player vs AI ───
// Side-view duel — move, jump, and shoot! First hit wins.

// ─── Constants ───
var W = 800, H = 500;
var GRAV = 1500;
var SPD = 300;
var JUMP = -560;
var BSPD = 700;
var CW = 24, CH = 36;
var BR = 3;

// ─── Canvas Setup ───
container.style.flexDirection = 'column';
var canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
canvas.style.cssText = 'border-radius:6px;display:block;max-width:95vw;max-height:75vh;';
container.appendChild(canvas);
var ctx = canvas.getContext('2d');

// ─── Input ───
var keys = {};
var shootHeld = false;
var gameKeys = ['ArrowLeft','ArrowRight','ArrowUp','Space','KeyW','KeyA','KeyD','KeyF','KeyR'];
var kd = function(e) {
  keys[e.code] = true;
  if (gameKeys.indexOf(e.code) >= 0) { e.preventDefault(); e.stopPropagation(); }
};
var ku = function(e) {
  keys[e.code] = false;
  if (gameKeys.indexOf(e.code) >= 0) { e.preventDefault(); e.stopPropagation(); }
};
var md = function() { shootHeld = true; };
var mu = function() { shootHeld = false; };
window.addEventListener('keydown', kd, true);
window.addEventListener('keyup', ku, true);
canvas.addEventListener('mousedown', md);
canvas.addEventListener('mouseup', mu);

// ─── Platforms ───
var plats = [
  { x: 0,         y: H - 16, w: W,   h: 16 },
  { x: 50,        y: 395,    w: 140,  h: 12 },
  { x: W - 190,   y: 395,    w: 140,  h: 12 },
  { x: W/2 - 80,  y: 335,    w: 160,  h: 12 },
  { x: 80,        y: 250,    w: 130,  h: 12 },
  { x: W - 210,   y: 250,    w: 130,  h: 12 },
  { x: W/2 - 65,  y: 170,    w: 130,  h: 12 },
];

// ─── Background Stars ───
var stars = [];
for (var si = 0; si < 50; si++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H * 0.7, r: Math.random() * 1.2 + 0.4, a: Math.random() * 0.4 + 0.2 });
}

// ─── State ───
function mkChar(x, y, col, right) {
  return { x: x, y: y, vx: 0, vy: 0, w: CW, h: CH, col: col, right: right, gnd: false, cd: 0, flash: 0 };
}

var p, ai, bullets, over, winner, raf, lt, hitX, hitY, hitT;
var aiDT, aiAct;

function reset() {
  p = mkChar(100, H - 56, '#3b82f6', true);
  ai = mkChar(W - 124, H - 56, '#ef4444', false);
  bullets = [];
  over = false;
  winner = '';
  hitX = 0; hitY = 0; hitT = 0;
  aiDT = 0;
  aiAct = { d: 0, j: false };
}

// ─── Collision (axis-separated) ───
function resolveX(e) {
  for (var i = 0; i < plats.length; i++) {
    var pl = plats[i];
    if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
    if (e.y + e.h - 1 <= pl.y || e.y + 1 >= pl.y + pl.h) continue;
    if (e.vx > 0) e.x = pl.x - e.w;
    else e.x = pl.x + pl.w;
  }
}

function resolveY(e) {
  e.gnd = false;
  for (var i = 0; i < plats.length; i++) {
    var pl = plats[i];
    if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
    if (e.y + e.h <= pl.y || e.y >= pl.y + pl.h) continue;
    if (e.vy >= 0) { e.y = pl.y - e.h; e.vy = 0; e.gnd = true; }
    else { e.y = pl.y + pl.h; e.vy = 0; }
  }
}

// ─── Shooting ───
function fire(src) {
  if (src.cd > 0) return;
  var d = src.right ? 1 : -1;
  bullets.push({
    x: src.x + src.w / 2 + d * (src.w / 2 + 4),
    y: src.y + 14,
    vx: BSPD * d,
    from: src,
  });
  src.cd = src === p ? 0.35 : 0.9;
  src.flash = 0.06;
}

// ─── AI Logic ───
function aiLogic(dt) {
  aiDT -= dt;
  if (aiDT <= 0) {
    aiDT = 0.12 + Math.random() * 0.2;
    var dx = p.x - ai.x;
    var dy = p.y - ai.y;
    var dist = Math.abs(dx);

    var dodge = false;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (b.from !== p) continue;
      var bd = Math.abs(b.x - (ai.x + ai.w / 2));
      if (bd < 280 && Math.abs(b.y - (ai.y + ai.h / 2)) < ai.h * 1.3) {
        dodge = true;
        break;
      }
    }

    if (dodge) {
      aiAct.j = true;
      aiAct.d = Math.random() < 0.5 ? 1 : -1;
    } else {
      if (dist < 130) aiAct.d = dx > 0 ? -1 : 1;
      else if (dist > 380) aiAct.d = dx > 0 ? 1 : -1;
      else aiAct.d = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? 1 : -1);
      aiAct.j = (dy < -40 && Math.random() < 0.6) || Math.random() < 0.1;
    }
  }

  ai.vx = aiAct.d * SPD;
  ai.right = p.x > ai.x;
  if (aiAct.j && ai.gnd) { ai.vy = JUMP; aiAct.j = false; }

  ai.cd -= dt;
  var ady = Math.abs(p.y - ai.y);
  var adx = Math.abs(p.x - ai.x);
  if (ai.cd <= 0 && ady < 45 && adx > 50 && adx < 650) fire(ai);
}

// ─── Update ───
function update(dt) {
  if (over) { hitT += dt; return; }

  p.vx = 0;
  if (keys.ArrowLeft || keys.KeyA) { p.vx = -SPD; p.right = false; }
  if (keys.ArrowRight || keys.KeyD) { p.vx = SPD; p.right = true; }
  if ((keys.ArrowUp || keys.KeyW || keys.Space) && p.gnd) p.vy = JUMP;

  p.cd -= dt;
  p.flash = Math.max(0, p.flash - dt);
  if ((keys.KeyF || shootHeld) && p.cd <= 0) fire(p);

  aiLogic(dt);
  ai.flash = Math.max(0, ai.flash - dt);

  var chars = [p, ai];
  for (var ci = 0; ci < chars.length; ci++) {
    var e = chars[ci];
    e.x += e.vx * dt;
    if (e.x < 0) e.x = 0;
    if (e.x + e.w > W) e.x = W - e.w;
    resolveX(e);
    e.vy += GRAV * dt;
    e.y += e.vy * dt;
    if (e.y + e.h > H) { e.y = H - e.h; e.vy = 0; e.gnd = true; }
    resolveY(e);
  }

  for (var i = bullets.length - 1; i >= 0; i--) {
    var b = bullets[i];
    b.x += b.vx * dt;
    if (b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }
    var tgt = b.from === p ? ai : p;
    if (b.x > tgt.x && b.x < tgt.x + tgt.w && b.y > tgt.y && b.y < tgt.y + tgt.h) {
      over = true;
      winner = b.from === p ? 'player' : 'ai';
      hitX = tgt.x + tgt.w / 2;
      hitY = tgt.y + tgt.h / 2;
      hitT = 0;
      bullets.splice(i, 1);
    }
  }
}

// ─── Draw ───
function draw() {
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (var si = 0; si < stars.length; si++) {
    var s = stars[si];
    ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Platforms
  for (var pi = 0; pi < plats.length; pi++) {
    var pl = plats[pi];
    ctx.fillStyle = '#475569';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(pl.x, pl.y, pl.w, 3);
  }

  // Characters
  var chars = [p, ai];
  for (var ci = 0; ci < chars.length; ci++) {
    var e = chars[ci];
    // Body
    ctx.fillStyle = e.col;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    // Head highlight
    ctx.fillStyle = e === p ? '#60a5fa' : '#f87171';
    ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, 12);
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.right ? e.x + e.w - 8 : e.x + 4, e.y + 5, 4, 4);
    // Pupil
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(e.right ? e.x + e.w - 6 : e.x + 4, e.y + 6, 2, 2);
    // Gun barrel
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(e.right ? e.x + e.w : e.x - 12, e.y + 13, 12, 3);
    // Muzzle flash
    if (e.flash > 0) {
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      var fx = e.right ? e.x + e.w + 12 : e.x - 14;
      ctx.beginPath();
      ctx.arc(fx, e.y + 14.5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Bullets
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 8;
  for (var bi = 0; bi < bullets.length; bi++) {
    var b = bullets[bi];
    ctx.beginPath();
    ctx.arc(b.x, b.y, BR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Impact ring
  if (over && hitT < 0.4) {
    var ir = hitT * 80;
    ctx.globalAlpha = 1 - hitT * 2.5;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hitX, hitY, ir, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // HUD
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD / Arrows: Move & Jump  |  F / Click: Shoot', 8, 14);

  // Character labels
  ctx.font = 'bold 11px system-ui,sans-serif';
  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'center';
  ctx.fillText('YOU', p.x + p.w / 2, p.y - 6);
  ctx.fillStyle = '#f87171';
  ctx.fillText('AI', ai.x + ai.w / 2, ai.y - 6);

  // Game over overlay
  if (over) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px system-ui,sans-serif';
    ctx.fillStyle = winner === 'player' ? '#4ade80' : '#f87171';
    ctx.fillText(winner === 'player' ? 'You Win!' : 'AI Wins!', W / 2, H / 2 - 20);
    ctx.font = '15px system-ui,sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Press R to play again', W / 2, H / 2 + 16);
  }

  ctx.textAlign = 'left';
}

// ─── Game Loop ───
function loop(t) {
  var dt = Math.min((t - lt) / 1000, 0.035);
  lt = t;
  if (over && keys.KeyR) { reset(); keys.KeyR = false; }
  update(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

reset();
lt = performance.now();
raf = requestAnimationFrame(loop);

// ─── Buttons ───
var btns = document.createElement('div');
btns.style.cssText = 'display:flex;gap:10px;margin-top:12px;';
container.appendChild(btns);

function mkBtn(txt, bg, hov, fn) {
  var b = document.createElement('button');
  b.textContent = txt;
  b.style.cssText = 'padding:8px 20px;border-radius:8px;border:none;font-size:14px;font-weight:600;cursor:pointer;color:white;transition:background .15s;background:' + bg;
  b.onmouseenter = function() { b.style.background = hov; };
  b.onmouseleave = function() { b.style.background = bg; };
  b.onclick = fn;
  btns.appendChild(b);
}

mkBtn('Continue', '#6366f1', '#4f46e5', function() { api.onComplete(); });
mkBtn('Play Again', '#334155', '#475569', function() { reset(); });

// ─── Cleanup ───
api.onCleanup(function() {
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', kd, true);
  window.removeEventListener('keyup', ku, true);
  canvas.removeEventListener('mousedown', md);
  canvas.removeEventListener('mouseup', mu);
});
`;
