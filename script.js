// Improved Pong: frame-rate independent, touch controls, persistence, difficulty, overlay
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreLeftEl = document.getElementById('score-left');
  const scoreRightEl = document.getElementById('score-right');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const difficultyEl = document.getElementById('difficulty');
  const bestScoreEl = document.getElementById('bestScore');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const overlayTitle = document.getElementById('overlayTitle');

  // Logical game size
  const GAME_W = 900;
  const GAME_H = 500;

  // Device pixel ratio handling for crisp canvas
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_W * dpr;
    canvas.height = GAME_H * dpr;
    canvas.style.width = Math.min(GAME_W, window.innerWidth - 40) + 'px';
    canvas.style.height = 'auto';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  // Game objects (logical coords)
  const paddleWidth = 12;
  const paddleHeight = 100;
  let paddleSpeed = 320; // px/s

  const player = {
    x: 20,
    y: (GAME_H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    color: '#00d4ff',
    prevY: null,
  };

  const comp = {
    x: GAME_W - 20 - paddleWidth,
    y: (GAME_H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    color: '#ff9f1c',
    maxSpeed: 240, // px/s (will be adjusted by difficulty)
  };

  const ball = {
    x: GAME_W / 2,
    y: GAME_H / 2,
    r: 8,
    baseSpeed: 420, // px/s
    speed: 420,
    vx: 420,
    vy: 0,
    color: '#e6eef6',
    maxSpeed: 1400,
  };

  let score = { left: 0, right: 0 };
  let running = false; // start paused until user presses Start
  let lastTime = 0;

  // Input
  let upPressed = false;
  let downPressed = false;
  let mouseControl = true;

  // Audio
  let audioCtx = null;
  let audioEnabled = JSON.parse(localStorage.getItem('pong_audio')) ?? true;
  soundBtn.textContent = audioEnabled ? 'Sound: On' : 'Sound: Off';

  function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
  }
  function resumeAudioIfNeeded() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playTone(freq = 440, type = 'sine', duration = 0.08, volume = 0.08, when = 0) {
    if (!audioEnabled) return;
    if (!audioCtx) {
      try { initAudio(); } catch (e) { return; }
    }
    if (!audioCtx) return;
    const now = audioCtx.currentTime + when;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + duration + 0.02);
  }
  function playPaddleHit() { playTone(900 + Math.random() * 120, 'square', 0.06, 0.09); }
  function playWallHit() { playTone(420 + Math.random() * 60, 'sine', 0.05, 0.06); }
  function playScore() { playTone(320, 'sawtooth', 0.12, 0.09, 0); playTone(480, 'sawtooth', 0.12, 0.09, 0.12); }

  // localStorage: best score & difficulty
  const STORAGE_KEYS = { BEST: 'pong_best', DIFF: 'pong_diff', AUDIO: 'pong_audio' };
  let best = parseInt(localStorage.getItem(STORAGE_KEYS.BEST) || '0', 10);
  bestScoreEl.textContent = best;
  const savedDiff = localStorage.getItem(STORAGE_KEYS.DIFF) || 'medium';
  difficultyEl.value = savedDiff;

  function applyDifficulty(v) {
    if (v === 'easy') {
      comp.maxSpeed = 160; ball.baseSpeed = 360; paddleSpeed = 300;
    } else if (v === 'medium') {
      comp.maxSpeed = 240; ball.baseSpeed = 420; paddleSpeed = 320;
    } else if (v === 'hard') {
      comp.maxSpeed = 360; ball.baseSpeed = 520; paddleSpeed = 360;
    }
    // clamp current ball speed to be at least base
    ball.speed = Math.max(ball.speed || 0, ball.baseSpeed);
  }
  applyDifficulty(savedDiff);

  // Initialize ball velocities
  function resetBall(toLeft = false) {
    ball.x = GAME_W / 2;
    ball.y = GAME_H / 2;
    ball.speed = ball.baseSpeed;
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
    const dir = toLeft ? -1 : 1;
    ball.vx = dir * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function drawBall() { ctx.fillStyle = ball.color; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); }
  function drawNet() { ctx.strokeStyle = 'rgba(230,238,246,0.08)'; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.beginPath(); ctx.moveTo(GAME_W / 2, 10); ctx.lineTo(GAME_W / 2, GAME_H - 10); ctx.stroke(); ctx.setLineDash([]); }

  function update(dt) {
    if (!running) return;
    // Player movement (keyboard)
    if (!mouseControl) {
      if (upPressed) player.y -= paddleSpeed * dt;
      if (downPressed) player.y += paddleSpeed * dt;
    }
    // Keep player in bounds
    player.y = clamp(player.y, 0, GAME_H - player.h);

    // Computer AI: simple following with smoothing
    const compCenter = comp.y + comp.h / 2;
    const deltaY = ball.y - compCenter;
    const move = clamp(deltaY * 0.9, -comp.maxSpeed * dt, comp.maxSpeed * dt); // small smoothing
    comp.y += move;
    comp.y = clamp(comp.y, 0, GAME_H - comp.h);

    // Store paddle velocities for spin
    const pPrev = player.prevY == null ? player.y : player.prevY;
    const paddleVel = dt > 0 ? (player.y - pPrev) / dt : 0; // px/s
    player.prevY = player.y;

    const cPrev = comp.prevY == null ? comp.y : comp.prevY;
    const compVel = dt > 0 ? (comp.y - cPrev) / dt : 0;
    comp.prevY = comp.y;

    // Move ball by velocity (px/s * dt)
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Collide with top/bottom
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
      resumeAudioIfNeeded(); playWallHit();
    } else if (ball.y + ball.r >= GAME_H) {
      ball.y = GAME_H - ball.r;
      ball.vy = -ball.vy;
      resumeAudioIfNeeded(); playWallHit();
    }

    // Left paddle collision
    if (ball.x - ball.r <= player.x + player.w) {
      if (ball.y >= player.y && ball.y <= player.y + player.h) {
        ball.x = player.x + player.w + ball.r;
        const relativeIntersectY = (player.y + player.h / 2) - ball.y;
        const normalized = relativeIntersectY / (player.h / 2);
        const bounceAngle = normalized * (Math.PI / 4);
        const speed = Math.min(ball.speed * 1.07, ball.maxSpeed);
        ball.speed = speed;
        const dir = 1;
        ball.vx = dir * speed * Math.cos(bounceAngle);
        ball.vy = -speed * Math.sin(bounceAngle);
        // add spin from paddle movement
        const spinFactor = 0.2;
        ball.vy += paddleVel * spinFactor;
        resumeAudioIfNeeded(); playPaddleHit();
      }
    }

    // Right paddle collision
    if (ball.x + ball.r >= comp.x) {
      if (ball.y >= comp.y && ball.y <= comp.y + comp.h) {
        ball.x = comp.x - ball.r;
        const relativeIntersectY = (comp.y + comp.h / 2) - ball.y;
        const normalized = relativeIntersectY / (comp.h / 2);
        const bounceAngle = normalized * (Math.PI / 4);
        const speed = Math.min(ball.speed * 1.07, ball.maxSpeed);
        ball.speed = speed;
        const dir = -1;
        ball.vx = dir * speed * Math.cos(bounceAngle);
        ball.vy = -speed * Math.sin(bounceAngle);
        const spinFactor = 0.15;
        ball.vy += compVel * spinFactor;
        resumeAudioIfNeeded(); playPaddleHit();
      }
    }

    // Check scoring
    if (ball.x + ball.r < 0) {
      // right scores
      score.right += 1;
      updateScoreboard(); resumeAudioIfNeeded(); playScore();
      updateBest();
      running = false; showOverlay('Right scores — Click to serve');
      resetBall(false);
    } else if (ball.x - ball.r > GAME_W) {
      // left scores
      score.left += 1;
      updateScoreboard(); resumeAudioIfNeeded(); playScore();
      updateBest();
      running = false; showOverlay('Left scores — Click to serve');
      resetBall(true);
    }
  }

  function render() {
    // Clear (logical size)
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    drawNet();
    drawRect(player.x, player.y, player.w, player.h, player.color);
    drawRect(comp.x, comp.y, comp.w, comp.h, comp.color);
    drawBall();
  }

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000); // cap dt to avoid big jumps
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  function updateScoreboard() {
    scoreLeftEl.textContent = score.left;
    scoreRightEl.textContent = score.right;
  }

  function updateBest() {
    const currentMax = Math.max(score.left, score.right);
    if (currentMax > best) {
      best = currentMax;
      localStorage.setItem(STORAGE_KEYS.BEST, String(best));
      bestScoreEl.textContent = best;
    }
  }

  // Input handlers
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = (e.clientY - rect.top) * (GAME_H / rect.height);
    mouseControl = true;
    player.y = clamp(mouseY - player.h / 2, 0, GAME_H - player.h);
  });
  canvas.addEventListener('click', () => { mouseControl = true; resumeAudioIfNeeded(); if (!running) hideOverlay(); });

  // Touch
  canvas.addEventListener('touchmove', e => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const y = (touch.clientY - rect.top) * (GAME_H / rect.height);
    mouseControl = true;
    player.y = clamp(y - player.h / 2, 0, GAME_H - player.h);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchstart', e => { resumeAudioIfNeeded(); if (!running) hideOverlay(); }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
      upPressed = true; mouseControl = false; e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
      downPressed = true; mouseControl = false; e.preventDefault();
    } else if (e.key === ' ') {
      running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; e.preventDefault();
    } else if (e.key.toLowerCase() === 'm') {
      audioEnabled = !audioEnabled; soundBtn.textContent = audioEnabled ? 'Sound: On' : 'Sound: Off'; localStorage.setItem(STORAGE_KEYS.AUDIO, JSON.stringify(audioEnabled));
      if (audioEnabled) resumeAudioIfNeeded();
    }
    resumeAudioIfNeeded();
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') upPressed = false; if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') downPressed = false; });

  // Buttons
  restartBtn.addEventListener('click', () => {
    score.left = 0; score.right = 0; updateScoreboard(); player.y = (GAME_H - player.h) / 2; comp.y = (GAME_H - comp.h) / 2; resetBall(Math.random() < 0.5); running = false; showOverlay('Restart — Click to Start');
  });
  pauseBtn.addEventListener('click', () => { running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; });
  soundBtn.addEventListener('click', () => { audioEnabled = !audioEnabled; soundBtn.textContent = audioEnabled ? 'Sound: On' : 'Sound: Off'; localStorage.setItem(STORAGE_KEYS.AUDIO, JSON.stringify(audioEnabled)); if (audioEnabled) resumeAudioIfNeeded(); });

  difficultyEl.addEventListener('change', (e) => { const v = e.target.value; applyDifficulty(v); localStorage.setItem(STORAGE_KEYS.DIFF, v); });

  // Disable scrolling when using arrow keys
  window.addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault(); }, { passive: false });

  // Overlay helpers
  function showOverlay(text) {
    overlayTitle.textContent = text || 'Click to Start';
    overlay.style.display = 'flex';
  }
  function hideOverlay() { overlay.style.display = 'none'; running = true; lastTime = 0; }

  startBtn.addEventListener('click', () => { hideOverlay(); resumeAudioIfNeeded(); });

  // Start
  updateScoreboard(); resetBall(Math.random() < 0.5); showOverlay('Click to Start');
  requestAnimationFrame(gameLoop);
})();
