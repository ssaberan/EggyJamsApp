export const WHACK_A_MOLE_SCRIPT = `
// ─── Whack-a-Mole ───
// Whack as many moles as you can in 30 seconds!

// ─── Constants ───
var W = 800, H = 500;
var COLS = 3, ROWS = 3;
var HOLE_R = 52;
var GRID_GAP = 28;
var GAME_DURATION = 30;

// Mole types: 0 = regular, 1 = golden, 2 = bomb
var TYPE_REGULAR = 0, TYPE_GOLDEN = 1, TYPE_BOMB = 2;
var TYPE_COLORS   = ['#c8864a', '#f5c518', '#cc2222'];
var TYPE_POINTS   = [1, 3, -1];
var TYPE_DURATION = [1.2, 0.75, 1.4];
var TYPE_WEIGHTS  = [7, 2, 1]; // out of 10

// ─── Canvas Setup ───
container.style.flexDirection = 'column';
var canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
canvas.style.cssText = 'border-radius:6px;display:block;max-width:95vw;max-height:75vh;cursor:pointer;';
container.appendChild(canvas);
var ctx = canvas.getContext('2d');

// ─── Input ───
var keys = {};
var kd = function(e) {
  keys[e.code] = true;
  if (e.code === 'KeyR') { e.preventDefault(); e.stopPropagation(); }
};
var ku = function(e) { keys[e.code] = false; };
window.addEventListener('keydown', kd, true);
window.addEventListener('keyup', ku, true);

// ─── Layout ───
var GRID_W = COLS * (HOLE_R * 2 + GRID_GAP) - GRID_GAP;
var GRID_H = ROWS * (HOLE_R * 2 + GRID_GAP) - GRID_GAP;
var GRID_LEFT = W / 2 - GRID_W / 2;
var GRID_TOP  = (H - GRID_H) / 2 + 24;

function holeCenter(col, row) {
  return {
    x: GRID_LEFT + col * (HOLE_R * 2 + GRID_GAP) + HOLE_R,
    y: GRID_TOP  + row * (HOLE_R * 2 + GRID_GAP) + HOLE_R,
  };
}

// ─── State ───
var score, timeLeft, over;
var moles;
var particles;
var floatingTexts;
var spawnAccum;
var SPAWN_INTERVAL = 0.42;
var raf, lt;

function mkMole() {
  return { visible: false, type: TYPE_REGULAR, timer: 0, hitAnim: 0 };
}

function pickType() {
  var r = Math.random() * 10;
  if (r < TYPE_WEIGHTS[0]) return TYPE_REGULAR;
  if (r < TYPE_WEIGHTS[0] + TYPE_WEIGHTS[1]) return TYPE_GOLDEN;
  return TYPE_BOMB;
}

function trySpawn() {
  var empty = [];
  for (var i = 0; i < moles.length; i++) {
    if (!moles[i].visible) empty.push(i);
  }
  if (empty.length === 0) return;
  if (Math.random() > 0.55) return;
  var idx = empty[Math.floor(Math.random() * empty.length)];
  var m = moles[idx];
  m.type = pickType();
  m.visible = true;
  m.timer = TYPE_DURATION[m.type];
  m.hitAnim = 0;
}

function spawnParticles(x, y, color) {
  for (var i = 0; i < 10; i++) {
    var angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    var speed = 70 + Math.random() * 90;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.55 + Math.random() * 0.2,
      color: color,
    });
  }
}

function reset() {
  score = 0;
  timeLeft = GAME_DURATION;
  over = false;
  moles = [];
  for (var i = 0; i < COLS * ROWS; i++) moles.push(mkMole());
  particles = [];
  floatingTexts = [];
  spawnAccum = 0;
  keys.KeyR = false;
}

// ─── Canvas click → whack ───
var clickHandler = function(e) {
  if (over) return;
  var rect = canvas.getBoundingClientRect();
  var scaleX = W / rect.width;
  var scaleY = H / rect.height;
  var mx = (e.clientX - rect.left) * scaleX;
  var my = (e.clientY - rect.top) * scaleY;

  for (var i = 0; i < moles.length; i++) {
    if (!moles[i].visible) continue;
    var col = i % COLS, row = Math.floor(i / COLS);
    var c = holeCenter(col, row);
    if (my > c.y + 8) continue;
    var moleY = c.y - 4;
    var rx = HOLE_R * 0.68, ry = HOLE_R * 0.72;
    var dx = (mx - c.x) / rx, dy = (my - moleY) / ry;
    if (dx * dx + dy * dy <= 1) {
      var m = moles[i];
      var speedFrac = m.timer / TYPE_DURATION[m.type];
      var pts;
      if (m.type === TYPE_BOMB) {
        pts = TYPE_POINTS[m.type];
      } else {
        pts = TYPE_POINTS[m.type] * (1 + Math.floor(speedFrac * 2));
      }
      score = Math.max(0, score + pts);
      var color = m.type === TYPE_GOLDEN ? '#f5c518' : pts > 0 ? '#4ade80' : '#f87171';
      spawnParticles(c.x, c.y, color);
      floatingTexts.push({
        x: c.x, y: moleY - HOLE_R * 0.5,
        text: (pts >= 0 ? '+' : '') + pts,
        life: 0.8,
        color: color
      });
      m.visible = false;
      m.hitAnim = 0.25;
      return;
    }
  }
};
canvas.addEventListener('click', clickHandler);

// ─── Update ───
function update(dt) {
  if (over) return;

  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    over = true;
    return;
  }

  spawnAccum += dt;
  if (spawnAccum >= SPAWN_INTERVAL) {
    spawnAccum = 0;
    trySpawn();
  }

  for (var i = 0; i < moles.length; i++) {
    var m = moles[i];
    if (m.visible) { m.timer -= dt; if (m.timer <= 0) m.visible = false; }
    if (m.hitAnim > 0) m.hitAnim -= dt;
  }

  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 140 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (var i = floatingTexts.length - 1; i >= 0; i--) {
    var ft = floatingTexts[i];
    ft.y -= 60 * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

// ─── Draw ───
function drawHole(x, y) {
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, HOLE_R, HOLE_R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d0d1a';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, HOLE_R * 0.76, HOLE_R * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMole(x, y, mole) {
  if (!mole.visible && mole.hitAnim <= 0) return;
  var alpha = mole.visible ? 1 : Math.max(0, mole.hitAnim / 0.25);
  var rise  = mole.visible ? 0 : (1 - mole.hitAnim / 0.25) * 16;
  ctx.globalAlpha = alpha;
  var my = y - 4 + rise;
  var bodyColor = TYPE_COLORS[mole.type];

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - HOLE_R - 10, 0, (HOLE_R + 10) * 2, y + 8);
  ctx.clip();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(x, my, HOLE_R * 0.68, HOLE_R * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = mole.type === TYPE_BOMB ? '#330000' : 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, my + 9, HOLE_R * 0.38, HOLE_R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (mole.type === TYPE_BOMB) {
    ctx.fillStyle = '#ff6666';
    ctx.font = 'bold ' + Math.round(HOLE_R * 0.72) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2620', x, my - 2);
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - 13, my - 9, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 13, my - 9, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(x - 11, my - 8, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14, my - 8, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9999';
    ctx.beginPath(); ctx.arc(x, my + 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, my + 5, 9, 0.2, Math.PI - 0.2); ctx.stroke();
    if (mole.type === TYPE_GOLDEN) {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(x - 16, my - 20);
      ctx.lineTo(x - 11, my - 32);
      ctx.lineTo(x,      my - 25);
      ctx.lineTo(x + 11, my - 32);
      ctx.lineTo(x + 16, my - 20);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6b4226';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, HOLE_R * 0.72, HOLE_R * 0.22, 0, 0, Math.PI);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function draw() {
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a2a1a');
  bg.addColorStop(1, '#0d1f0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#3a7a32';
  ctx.fillRect(0, H - 30, W, 8);

  // Holes then moles
  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      var c = holeCenter(col, row);
      drawHole(c.x, c.y);
    }
  }
  for (var i = 0; i < moles.length; i++) {
    var col = i % COLS, row = Math.floor(i / COLS);
    var c = holeCenter(col, row);
    drawMole(c.x, c.y, moles[i]);
  }

  // Score (top-left)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px system-ui,sans-serif';
  ctx.fillText('SCORE', 20, 36);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 32px system-ui,sans-serif';
  ctx.fillText(score, 20, 66);

  // Timer (top-right)
  var timerColor = timeLeft <= 10 ? '#f87171' : '#e2e8f0';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px system-ui,sans-serif';
  ctx.fillText('TIME', W - 20, 36);
  ctx.fillStyle = timerColor;
  ctx.font = 'bold 32px system-ui,sans-serif';
  ctx.fillText(Math.ceil(timeLeft) + 's', W - 20, 66);

  // Legend
  ctx.textAlign = 'center';
  ctx.font = '11px system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('\u2605 Golden 3\u20139   \u2620 Bomb \u22121   Mole 1\u20133   |   Faster = more pts!', W / 2, H - 10);

  // Particles
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life / 0.75);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating score text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px system-ui,sans-serif';
  for (var i = 0; i < floatingTexts.length; i++) {
    var ft = floatingTexts[i];
    ctx.globalAlpha = Math.max(0, ft.life / 0.8);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  // Game over overlay
  if (over) {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 42px system-ui,sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText("Time's Up!", W / 2, H / 2 - 40);
    ctx.font = '22px system-ui,sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('You scored ' + score + ' point' + (score === 1 ? '' : 's') + '!', W / 2, H / 2 + 4);
    ctx.font = '14px system-ui,sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press R to play again', W / 2, H / 2 + 40);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ─── Game Loop ───
function loop(t) {
  var dt = Math.min((t - lt) / 1000, 0.05);
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

mkBtn('Continue',   '#6366f1', '#4f46e5', function() { api.onComplete(); });
mkBtn('Play Again', '#334155', '#475569', function() { reset(); });

// ─── Cleanup ───
api.onCleanup(function() {
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', kd, true);
  window.removeEventListener('keyup', ku, true);
  canvas.removeEventListener('click', clickHandler);
});
`;
