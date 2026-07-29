// Simple Pong implementation with sound effects (Web Audio API)
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreLeftEl = document.getElementById('score-left');
  const scoreRightEl = document.getElementById('score-right');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');

  const W = canvas.width;
  const H = canvas.height;

  // Game objects
  const paddleWidth = 12;
  const paddleHeight = 100;
  const paddleSpeed = 6;

  const player = {
    x: 20,
    y: (H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    color: '#00d4ff',
  };

  const comp = {
    x: W - 20 - paddleWidth,
    y: (H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    color: '#ff9f1c',
    maxSpeed: 5, // AI max speed
  };

  const ball = {
    x: W / 2,
    y: H / 2,
    r: 8,
    speed: 5,
    vx: 5,
    vy: 2,
    color: '#e6eef6',
  };

  let score = { left: 0, right: 0 };
  let running = true;
  let lastTime = 0;

  // Input
  let upPressed = false;
  let downPressed = false;
  let mouseControl = true;

  // Audio (Web Audio API)
  let audioCtx = null;
  let audioEnabled = true;

  function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
  }

  function resumeAudioIfNeeded() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
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
    // quick exponential fade to avoid clicks
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + duration + 0.02);
  }

  function playPaddleHit() {
    // bright short square tone
    playTone(900 + Math.random() * 120, 'square', 0.06, 0.09);
  }

  function playWallHit() {
    // lower sine tone
    playTone(420 + Math.random() * 60, 'sine', 0.05, 0.06);
  }

  function playScore() {
    // two ascending notes
    playTone(320, 'sawtooth', 0.12, 0.09, 0);
    playTone(480, 'sawtooth', 0.12, 0.09, 0.12);
  }

  // Initialize ball velocities to random direction
  function resetBall(toLeft = false) {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.speed = 5;
    // Randomize angle slightly
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // -22.5 to 22.5 deg
    const dir = toLeft ? -1 : 1;
    ball.vx = dir * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  // Clamp helper
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // Draw helpers
  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawBall() {
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawNet() {
    ctx.strokeStyle = 'rgba(230,238,246,0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 10);
    ctx.lineTo(W / 2, H - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function update(dt) {
    if (!running) return;

    // Player paddle movement (keyboard)
    if (!mouseControl) {
      if (upPressed) player.y -= paddleSpeed;
      if (downPressed) player.y += paddleSpeed;
    }

    // Keep player in bounds
    player.y = clamp(player.y, 0, H - player.h);

    // Simple computer AI: follow ball with a max speed and slight delay
    const compCenter = comp.y + comp.h / 2;
    const deltaY = ball.y - compCenter;
    const move = clamp(deltaY * 0.09, -comp.maxSpeed, comp.maxSpeed); // smoothing factor 0.09
    comp.y += move;
    comp.y = clamp(comp.y, 0, H - comp.h);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Collide with top/bottom walls
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
      resumeAudioIfNeeded();
      playWallHit();
    } else if (ball.y + ball.r >= H) {
      ball.y = H - ball.r;
      ball.vy = -ball.vy;
      resumeAudioIfNeeded();
      playWallHit();
    }

    // Check left paddle collision
    if (ball.x - ball.r <= player.x + player.w) {
      if (ball.y >= player.y && ball.y <= player.y + player.h) {
        // Hit the left paddle
        ball.x = player.x + player.w + ball.r;
        // Reflect and add spin based on where it hit the paddle
        const relativeIntersectY = (player.y + player.h / 2) - ball.y;
        const normalized = relativeIntersectY / (player.h / 2);
        const bounceAngle = normalized * (Math.PI / 4); // max 45deg
        const speed = Math.min(ball.speed * 1.07, 14); // increase slightly
        ball.speed = speed;
        const dir = 1; // going right now
        ball.vx = dir * speed * Math.cos(bounceAngle);
        ball.vy = -speed * Math.sin(bounceAngle);
        resumeAudioIfNeeded();
        playPaddleHit();
      }
    }

    // Check right paddle collision
    if (ball.x + ball.r >= comp.x) {
      if (ball.y >= comp.y && ball.y <= comp.y + comp.h) {
        // Hit the right paddle
        ball.x = comp.x - ball.r;
        const relativeIntersectY = (comp.y + comp.h / 2) - ball.y;
        const normalized = relativeIntersectY / (comp.h / 2);
        const bounceAngle = normalized * (Math.PI / 4);
        const speed = Math.min(ball.speed * 1.07, 14);
        ball.speed = speed;
        const dir = -1;
        ball.vx = dir * speed * Math.cos(bounceAngle);
        ball.vy = -speed * Math.sin(bounceAngle);
        resumeAudioIfNeeded();
        playPaddleHit();
      }
    }

    // Check scoring
    if (ball.x + ball.r < 0) {
      // right scores
      score.right += 1;
      updateScoreboard();
      resumeAudioIfNeeded();
      playScore();
      resetBall(false);
    } else if (ball.x - ball.r > W) {
      // left scores
      score.left += 1;
      updateScoreboard();
      resumeAudioIfNeeded();
      playScore();
      resetBall(true);
    }
  }

  function render() {
    // Clear
    ctx.clearRect(0, 0, W, H);

    // Draw net
    drawNet();

    // Draw paddles and ball
    drawRect(player.x, player.y, player.w, player.h, player.color);
    drawRect(comp.x, comp.y, comp.w, comp.h, comp.color);
    drawBall();
  }

  function gameLoop(timestamp) {
    const dt = (timestamp - lastTime) / 1000 || 0;
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  // Scoreboard update
  function updateScoreboard() {
    scoreLeftEl.textContent = score.left;
    scoreRightEl.textContent = score.right;
  }

  // Input handlers
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    // Use mouse control (overrides keyboard while active)
    mouseControl = true;
    player.y = clamp(mouseY - player.h / 2, 0, H - player.h);
  });

  // If the user clicks canvas, switch to mouse control and enable audio (user gesture)
  canvas.addEventListener('click', () => {
    mouseControl = true;
    resumeAudioIfNeeded();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      upPressed = true;
      mouseControl = false;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      downPressed = true;
      mouseControl = false;
      e.preventDefault();
    } else if (e.key === ' ') {
      running = !running;
      pauseBtn.textContent = running ? 'Pause' : 'Resume';
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'm') {
      // Toggle sound with 'M'
      audioEnabled = !audioEnabled;
      soundBtn.textContent = audioEnabled ? 'Sound: On' : 'Sound: Off';
    }
    // resume audio from keypress as required by browsers
    resumeAudioIfNeeded();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') upPressed = false;
    if (e.key === 'ArrowDown') downPressed = false;
  });

  // Buttons
  restartBtn.addEventListener('click', () => {
    score.left = 0;
    score.right = 0;
    updateScoreboard();
    player.y = (H - player.h) / 2;
    comp.y = (H - comp.h) / 2;
    resetBall(Math.random() < 0.5);
    running = true;
    pauseBtn.textContent = 'Pause';
    resumeAudioIfNeeded();
  });

  pauseBtn.addEventListener('click', () => {
    running = !running;
    pauseBtn.textContent = running ? 'Pause' : 'Resume';
  });

  soundBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    soundBtn.textContent = audioEnabled ? 'Sound: On' : 'Sound: Off';
    if (audioEnabled) resumeAudioIfNeeded();
  });

  // Prevent page scroll on arrow keys when focused
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }, { passive: false });

  // Start game
  updateScoreboard();
  resetBall(Math.random() < 0.5);
  requestAnimationFrame(gameLoop);
})();
