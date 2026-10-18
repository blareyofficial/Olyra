(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const dialog = document.getElementById('game-dialog');
  const title = document.getElementById('game-title');
  const description = document.getElementById('game-description');
  const controls = document.getElementById('game-controls');
  const status = document.getElementById('game-status');
  const hint = document.getElementById('game-hint');
  const filter = document.getElementById('game-filter');
  const grid = document.getElementById('game-grid');
  const chatApi = '/api/chat';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const gameDetails = {
    drive: ['Olyra Drive', 'Cruise around a shared little world. Create a private room and share its invite with a friend.', 'WASD or arrow keys to drive. Your private room uses the same encrypted Olyra Chat service.'],
    stars: ['Star Catcher', 'Collect stars and dodge meteors. The longer you last, the busier the sky gets.', 'Use left and right arrows or A and D to steer.'],
    runner: ['Neon Rush', 'Leap over roadblocks and duck under neon barriers as the city speeds up.', 'Space or ↑ to jump · ↓ to slide.'],
    blocks: ['Block Logic', 'Arrange falling shapes to clear complete rows. There is no clock, so think ahead.', '← / → move · ↑ rotate · ↓ drop.'],
    orbit: ['Orbital Chaos', 'Add a few planets and watch them tug each other across a tiny starfield.', 'Click the field to launch a planet. R resets the system.'],
    maze: ['Maze Breaker', 'Find the key, collect the treasure, and reach the exit in a newly made maze.', 'Arrow keys or WASD to move.'],
    beat: ['Beat Reactor', 'Follow the visual pulse and hit the matching key as each note reaches the line. Load a custom chart to play along with royalty-free music.', 'Hit D, F, J, or K as its note reaches the pulse line.'],
    colony: ['Tiny Colony', 'Grow a tiny outpost. Gather supplies, build homes, and keep your astronauts happy.', 'Choose actions below to grow your colony.'],
    pixel: ['Pixelbound', 'Collect the coins and leap between platforms in this bite-sized pixel world.', '← / → or A / D to move · Space or ↑ to jump.'],
    signal: ['Signal Sweep', 'Reveal safe tiles and use the number clues to mark every hidden signal.', 'Click to reveal · right-click to flag.'],
    bots: ['Bumper Bots', 'Bump the rival robots off the platform. Survive the arena to win.', 'P1: WASD · P2: arrows · press R to reset.'],
    space: ['Space Solution', 'Remake a miniature solar system. The Olyra backend calculates gravity in bounded steps, so your browser can focus on drawing.', 'Add planets and objects, change gravity, and watch the simulation stats update.']
  };
  let currentGame = '';
  let gameState = null;
  let botsOpponent = 'ai';
  let lastFrame = 0;
  let raf = 0;

  const random = (min, max) => min + Math.random() * (max - min);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const b64 = (bytes) => {
    let raw = '';
    for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64 = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0));
  const setStatus = (message) => { if (status.textContent !== message) status.textContent = message; };
  const addControl = (label, callback) => {
    const button = make('button', '', label);
    button.type = 'button';
    button.addEventListener('click', callback);
    controls.append(button);
    return button;
  };
  const addSelect = (label, values, selected, callback) => {
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    for (const [value, text] of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = value === selected;
      select.append(option);
    }
    select.addEventListener('change', () => callback(select.value));
    controls.append(select);
    return select;
  };
  const scoreText = (score) => { setStatus(`Score ${score}`); };
  const storedBest = (key, score) => {
    try {
      const best = Number(localStorage.getItem(key)) || 0;
      if (score > best) localStorage.setItem(key, String(score));
      return Math.max(score, best);
    } catch {
      return score;
    }
  };
  const randomColor = () => ['#72d8ff', '#ff4f9a', '#ffe48a', '#a2edb4', '#b184ff'][Math.floor(Math.random() * 5)];
  const seededRandom = (seed) => () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const newOrbitBodies = () => [
    { x: 400, y: 225, vx: 0, vy: 0, mass: 900, radius: 20, color: '#ffe48a' },
    { x: 545, y: 225, vx: 0, vy: -1.75, mass: 14, radius: 8, color: '#72d8ff' },
    { x: 300, y: 225, vx: 0, vy: 1.35, mass: 8, radius: 6, color: '#ff4f9a' }
  ];

  function closeGame() {
    cancelAnimationFrame(raf);
    if (gameState?.drive?.poller) clearInterval(gameState.drive.poller);
    if (gameState?.drive?.sender) clearInterval(gameState.drive.sender);
    if (dialog.open) dialog.close();
    gameState = null;
    currentGame = '';
  }

  function openGame(name) {
    closeGame();
    currentGame = name;
    gameState = {};
    title.textContent = gameDetails[name][0];
    description.textContent = gameDetails[name][1];
    hint.textContent = gameDetails[name][2];
    controls.replaceChildren();
    setStatus('');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dialog.showModal();
    initializeGame(name);
    lastFrame = performance.now();
    raf = requestAnimationFrame(loop);
    if (name === 'drive' && new URLSearchParams(location.search).has('room') && location.hash.length > 1) {
      joinDrive(new URLSearchParams(location.search).get('room'), location.hash.slice(1)).catch((error) => setStatus(error.message));
    }
  }

  document.querySelectorAll('.game-play').forEach((button) => button.addEventListener('click', () => openGame(button.dataset.game)));
  document.getElementById('game-close').addEventListener('click', closeGame);
  document.getElementById('game-restart').addEventListener('click', () => {
    if (currentGame) openGame(currentGame);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeGame();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeGame();
  });
  filter.addEventListener('change', () => {
    const chosen = filter.value.toLowerCase();
    grid.querySelectorAll('.game-card').forEach((card) => {
      card.hidden = chosen !== 'all' && !card.dataset.genre.toLowerCase().split(' ').includes(chosen);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (!dialog.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    if (currentGame === 'blocks') handleBlockKey(event.key);
    if (currentGame === 'maze') moveMaze(event.key);
    if (currentGame === 'pixel') handlePixelKey(event.key);
    if (currentGame === 'bots') handleBotsKey(event.key);
    if (currentGame === 'runner') handleRunnerKey(event.key);
    if (currentGame === 'beat') hitBeat(event.key);
    if (currentGame === 'stars' && ['ArrowLeft', 'a', 'A'].includes(event.key)) gameState.player.x = Math.max(24, gameState.player.x - 24);
    if (currentGame === 'stars' && ['ArrowRight', 'd', 'D'].includes(event.key)) gameState.player.x = Math.min(776, gameState.player.x + 24);
    if (currentGame === 'orbit' && event.key.toLowerCase() === 'r') {
      gameState.bodies = [{ x: 400, y: 220, vx: 0, vy: 0, mass: 2000, radius: 22, color: '#ffe48a' }, { x: 535, y: 220, vx: 0, vy: -40, mass: 28, radius: 9, color: '#72d8ff' }, { x: 260, y: 220, vx: 0, vy: 32, mass: 18, radius: 7, color: '#ff4f9a' }];
      gameState.time = 0; gameState.over = false;
      setStatus('Orbital system reset.');
    }
    if (currentGame === 'bots' && event.key.toLowerCase() === 'r') initializeBots();
  });

  function initializeGame(name) {
    if (name === 'drive') initializeDrive();
    if (name === 'stars') initializeStars();
    if (name === 'runner') initializeRunner();
    if (name === 'blocks') initializeBlocks();
    if (name === 'orbit') initializeOrbit();
    if (name === 'maze') initializeMaze();
    if (name === 'beat') initializeBeat();
    if (name === 'colony') initializeColony();
    if (name === 'pixel') initializePixel();
    if (name === 'signal') initializeSignal();
    if (name === 'bots') initializeBots();
    if (name === 'space') initializeSpace();
  }

  function initializeStars() {
    const state = gameState;
    state.player = { x: 400, y: 390, color: randomColor() };
    state.entities = [];
    state.score = 0;
    state.lives = 3;
    state.time = 0;
    state.spawn = 0;
    state.over = false;
    const colors = [['Blue', '#72d8ff', 0], ['Pink', '#ff4f9a', 30], ['Gold', '#ffe48a', 80], ['Green', '#a2edb4', 150]];
    const best = storedBest('olyra-star-best', 0);
    const selector = addSelect('Ship colour', colors.map(([, color, unlock]) => [color, color]), state.player.color, (value) => { state.player.color = value; });
    [...selector.options].forEach((option) => {
      const [name, , unlock] = colors.find(([, color]) => color === option.value);
      option.textContent = unlock ? `${name}${best < unlock ? ` · ${unlock} points to unlock` : ''}` : name;
      option.disabled = best < unlock;
    });
    scoreText(`Score 0 · Best ${best}`);
  }

  function initializeRunner() {
    gameState = { player: { y: 355, vy: 0, jumping: false, sliding: false, slideTime: 0 }, obstacles: [], score: 0, time: 0, spawn: 0, speed: 240, over: false };
    setStatus('Score 0 · Speed 1×');
  }

  const shapes = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
  ];
  function initializeBlocks() {
    const dateSeed = new Date().toISOString().slice(0, 10).split('-').join('');
    gameState = { grid: Array.from({ length: 20 }, () => Array(10).fill('')), score: 0, piece: null, over: false, rng: seededRandom(Number(dateSeed)) };
    nextBlock();
    setStatus(`Daily board · ${dateSeed} · Complete rows at your own pace`);
  }
  function nextBlock() {
    const colors = ['#72d8ff', '#ff4f9a', '#ffe48a', '#a2edb4', '#b184ff'];
    const shape = shapes[Math.floor(gameState.rng() * shapes.length)];
    gameState.piece = { shape, x: Math.floor((10 - shape[0].length) / 2), y: 0, color: colors[Math.floor(gameState.rng() * colors.length)] };
    if (blockCollides(gameState.piece.x, gameState.piece.y, shape)) gameState.over = true;
  }
  function blockCollides(x, y, shape) {
    return shape.some((row, dy) => row.some((cell, dx) => cell && (x + dx < 0 || x + dx >= 10 || y + dy >= 20 || (y + dy >= 0 && gameState.grid[y + dy][x + dx]))));
  }
  function handleBlockKey(key) {
    const piece = gameState.piece;
    if (!piece || gameState.over) return;
    if (key === 'ArrowLeft' && !blockCollides(piece.x - 1, piece.y, piece.shape)) piece.x--;
    if (key === 'ArrowRight' && !blockCollides(piece.x + 1, piece.y, piece.shape)) piece.x++;
    if (key === 'ArrowDown') {
      if (!blockCollides(piece.x, piece.y + 1, piece.shape)) piece.y++;
      else dropBlock();
    }
    if (key === ' ' || key === 'ArrowUp') {
      const rotated = piece.shape[0].map((_, column) => piece.shape.map((row) => row[column]).reverse());
      if (!blockCollides(piece.x, piece.y, rotated)) piece.shape = rotated;
    }
  }
  function dropBlock() {
    const piece = gameState.piece;
    if (!piece) return;
    if (!blockCollides(piece.x, piece.y + 1, piece.shape)) {
      piece.y++;
      return;
    }
    piece.shape.forEach((row, dy) => row.forEach((cell, dx) => { if (cell && piece.y + dy >= 0) gameState.grid[piece.y + dy][piece.x + dx] = piece.color; }));
    const remaining = gameState.grid.filter((row) => row.some((cell) => !cell));
    const cleared = 20 - remaining.length;
    gameState.score += cleared * cleared * 100;
    gameState.grid = Array.from({ length: cleared }, () => Array(10).fill('')).concat(remaining);
    nextBlock();
  }

  function initializeOrbit() {
    gameState = { bodies: [{ x: 400, y: 220, vx: 0, vy: 0, mass: 2000, radius: 22, color: '#ffe48a' }, { x: 535, y: 220, vx: 0, vy: -40, mass: 28, radius: 9, color: '#72d8ff' }, { x: 260, y: 220, vx: 0, vy: 32, mass: 18, radius: 7, color: '#ff4f9a' }], time: 0, gravity: 1700 };
    addControl('Gravity +', () => { gameState.gravity = Math.min(4000, gameState.gravity + 250); });
    addControl('Gravity −', () => { gameState.gravity = Math.max(250, gameState.gravity - 250); });
  }
  canvas.addEventListener('click', (event) => {
    if (currentGame !== 'orbit' || !dialog.open) return;
    const rect = canvas.getBoundingClientRect();
    if (gameState.bodies.length < 16) gameState.bodies.push({ x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height, vx: random(-35, 35), vy: random(-35, 35), mass: 10, radius: 7, color: randomColor() });
  });

  function initializeMaze() {
    const cols = 13, rows = 9;
    const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ walls: [true, true, true, true], seen: false })));
    const stack = [[0, 0]];
    cells[0][0].seen = true;
    const directions = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    while (stack.length) {
      const [x, y] = stack.at(-1);
      const options = directions.map((dir, i) => ({ dir, i })).filter(({ dir }) => {
        const nx = x + dir[0], ny = y + dir[1];
        return nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[ny][nx].seen;
      });
      if (!options.length) { stack.pop(); continue; }
      const { dir, i } = options[Math.floor(Math.random() * options.length)];
      const nx = x + dir[0], ny = y + dir[1];
      cells[y][x].walls[i] = false;
      cells[ny][nx].walls[dir[3]] = false;
      cells[ny][nx].seen = true;
      stack.push([nx, ny]);
    }
    gameState = { cells, x: 0, y: 0, key: [Math.floor(cols / 2), Math.floor(rows / 2)], treasure: [cols - 2, 1], exit: [cols - 1, rows - 1], enemy: [cols - 2, rows - 2], moves: 0, hasKey: false, score: 0, won: false, lost: false };
    setStatus('Find the key and treasure, then reach the glowing exit.');
  }
  function moveMaze(key) {
    const move = { ArrowUp: [0, -1, 0], w: [0, -1, 0], W: [0, -1, 0], ArrowRight: [1, 0, 1], d: [1, 0, 1], D: [1, 0, 1], ArrowDown: [0, 1, 2], s: [0, 1, 2], S: [0, 1, 2], ArrowLeft: [-1, 0, 3], a: [-1, 0, 3], A: [-1, 0, 3] }[key];
    if (!move || gameState.won || gameState.lost) return;
    const [dx, dy, wall] = move;
    if (!gameState.cells[gameState.y][gameState.x].walls[wall]) {
      gameState.x += dx; gameState.y += dy;
      gameState.moves++;
      if (gameState.moves % 4 === 0) {
        const directions = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
        const [ex, ey] = gameState.enemy;
        const exits = directions.filter((dir) => !gameState.cells[ey][ex].walls[dir[2]]);
        if (exits.length) {
          const [edx, edy] = exits[Math.floor(Math.random() * exits.length)];
          gameState.enemy = [ex + edx, ey + edy];
        }
      }
      if (gameState.x === gameState.enemy[0] && gameState.y === gameState.enemy[1]) { gameState.lost = true; setStatus('A roaming bot caught you! Press Restart to escape a new maze.'); return; }
      if (gameState.x === gameState.key[0] && gameState.y === gameState.key[1]) { gameState.hasKey = true; setStatus('Key found! Find the treasure, then the exit.'); }
      if (gameState.x === gameState.treasure[0] && gameState.y === gameState.treasure[1]) { gameState.score += 100; gameState.treasure = [-1, -1]; setStatus('Treasure collected! Find the exit.'); }
      if (gameState.hasKey && gameState.x === gameState.exit[0] && gameState.y === gameState.exit[1]) { gameState.won = true; setStatus(`Maze escaped! Score ${gameState.score + 250}`); }
    }
  }

  function initializeBeat() {
    gameState = { notes: [], score: 0, combo: 0, misses: 0, time: 0, next: 0.8, keys: ['d', 'f', 'j', 'k'], pattern: ['d', 'f', 'j', 'k'], patternIndex: 0 };
    setStatus('0 hits · Watch for the pulse');
    const chart = document.createElement('input');
    chart.maxLength = 128; chart.placeholder = 'Custom chart: d f j k'; chart.setAttribute('aria-label', 'Custom rhythm chart using D, F, J, and K');
    const loadChart = make('button', '', 'Load chart');
    loadChart.type = 'button';
    loadChart.addEventListener('click', () => {
      const sequence = chart.value.toLowerCase().replace(/[\s,|]+/g, '');
      if (!sequence || sequence.length > 64 || !/^[dfjk]+$/.test(sequence)) { setStatus('Use 1–64 chart notes made only from D, F, J, and K.'); return; }
      gameState.pattern = [...sequence];
      gameState.patternIndex = 0;
      setStatus(`Custom chart loaded · ${sequence.length} notes`);
    });
    controls.append(chart, loadChart);
    addControl('Start beat', () => { gameState.time = 0; gameState.notes = []; gameState.next = 0.2; gameState.patternIndex = 0; gameState.started = true; });
  }
  function hitBeat(key) {
    if (!gameState.started || !gameState.keys.includes(key.toLowerCase())) return;
    const note = gameState.notes.filter((item) => item.key === key.toLowerCase()).sort((a, b) => Math.abs(a.x - 120) - Math.abs(b.x - 120))[0];
    if (note && Math.abs(note.x - 120) < 70) {
      gameState.notes.splice(gameState.notes.indexOf(note), 1);
      gameState.score += Math.abs(note.x - 120) < 25 ? 150 : 100;
      gameState.combo++;
    } else gameState.combo = 0;
    setStatus(`${gameState.score} points · ${gameState.combo} combo · ${gameState.misses} misses`);
  }

  function initializeColony() {
    gameState = { food: 12, metal: 8, energy: 6, people: 3, happiness: 70, homes: 1, farms: 0, generators: 0, labs: 0, observatories: 0, day: 1 };
    const panel = make('div', 'colony-controls');
    const choices = [
      ['Gather food', 'food', 3, 0, 0, 'food +3'],
      ['Mine metal', 'metal', 2, 0, 0, 'metal +2'],
      ['Build habitat · 5 metal', 'home', 0, -5, 0, 'home +1'],
      ['Build farm · 4 metal', 'farm', 0, -4, 0, 'farm +1'],
      ['Build generator · 3 metal', 'generator', 0, -3, 0, 'energy +1'],
      ['Build research lab · unlock day 5 · 8 metal', 'lab', 0, -8, 0, 'lab +1'],
      ['Build observatory · unlock day 10 · 12 metal', 'observatory', 0, -12, 0, 'observatory +1']
    ];
    for (const [label, action] of choices) {
      const button = make('button', '', label);
      button.type = 'button';
      button.dataset.action = action;
      button.addEventListener('click', () => colonyAction(action));
      panel.append(button);
    }
    controls.append(panel);
    updateColonyControls();
    setStatus(colonyStats());
  }
  function colonyStats() {
    const s = gameState;
    return `Day ${s.day} · ${s.people} astronauts · ${s.homes} habitats · ${s.labs} labs · ${s.observatories} observatories · food ${s.food} · metal ${s.metal} · energy ${s.energy} · happiness ${s.happiness}%`;
  }
  function colonyAction(action) {
    const s = gameState;
    if (action === 'food') s.food += 3;
    if (action === 'metal') s.metal += 2;
    if (action === 'home' && s.metal >= 5) { s.metal -= 5; s.homes++; s.people++; }
    else if (action === 'farm' && s.metal >= 4) { s.metal -= 4; s.farms++; }
    else if (action === 'generator' && s.metal >= 3) { s.metal -= 3; s.generators++; s.energy++; }
    else if (action === 'lab' && s.day >= 5 && s.metal >= 8) { s.metal -= 8; s.labs++; }
    else if (action === 'observatory' && s.day >= 10 && s.metal >= 12) { s.metal -= 12; s.observatories++; }
    else if (['home', 'farm', 'generator', 'lab', 'observatory'].includes(action)) { setStatus(`Building locked or not enough metal. ${colonyStats()}`); return; }
    s.day++;
    s.food -= Math.max(1, s.people - s.farms);
    s.energy = Math.max(0, s.energy + s.generators - 1);
    s.happiness = Math.max(0, Math.min(100, s.happiness + (s.food > 0 && s.energy > 0 ? 2 : -12)));
    updateColonyControls();
    if (s.happiness === 0) setStatus(`Colony needs help. ${colonyStats()}`);
    else setStatus(colonyStats());
  }
  function updateColonyControls() {
    const s = gameState;
    controls.querySelectorAll('.colony-controls button').forEach((button) => {
      const action = button.dataset.action;
      const unlockDay = action === 'lab' ? 5 : action === 'observatory' ? 10 : 1;
      const cost = action === 'lab' ? 8 : action === 'observatory' ? 12 : 0;
      button.disabled = s.day < unlockDay || s.metal < cost;
    });
  }

  function initializePixel() {
    const level = [[0, 410, 800, 40], [170, 335, 130, 14], [365, 270, 130, 14], [560, 210, 130, 14], [325, 145, 100, 14]];
    const sharedLevel = new URLSearchParams(location.search).get('level');
    let levelStatus = '';
    if (sharedLevel) {
      try {
        if (sharedLevel.length > 2200) throw new Error('shared level is too large');
        const platforms = JSON.parse(decoder.decode(unb64(sharedLevel)));
        if (!Array.isArray(platforms) || platforms.length > 16 || platforms.some((platform) =>
          !Array.isArray(platform) || platform.length !== 4 ||
          !Number.isFinite(platform[0]) || platform[0] < 0 || platform[0] > 760 ||
          !Number.isFinite(platform[1]) || platform[1] < 40 || platform[1] > 390 ||
          !Number.isFinite(platform[2]) || platform[2] < 30 || platform[2] > 180 ||
          platform[0] + platform[2] > 800 ||
          !Number.isFinite(platform[3]) || platform[3] < 8 || platform[3] > 30
        )) throw new Error('shared level has invalid platforms');
        level.splice(1, level.length - 1, ...platforms);
        levelStatus = ' · shared level loaded';
      } catch (error) {
        levelStatus = ` · invalid shared level (${error.message}); demo loaded`;
      }
    }
    gameState = { player: { x: 60, y: 330, vx: 0, vy: 0, onGround: false }, platforms: level, coins: [[210, 300], [410, 235], [610, 175], [365, 110]], score: 0, won: false, editing: false };
    const editor = addControl('Open level editor', () => {
      gameState.editing = !gameState.editing;
      editor.textContent = gameState.editing ? 'Play level' : 'Open level editor';
      setStatus(gameState.editing ? 'Editor open · click to place platforms · up to 16' : 'Playtest the level and collect the coins.');
    });
    addControl('Share level', async () => {
      const custom = gameState.platforms.slice(1);
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set('level', b64(encoder.encode(JSON.stringify(custom))));
      try {
        await navigator.clipboard.writeText(url.href);
        setStatus('Shareable level link copied.');
      } catch (error) {
        setStatus(`Could not copy the level link: ${error.message}`);
      }
    });
    if (levelStatus) setStatus(`Coins 0 · Reach the top platform${levelStatus}`);
    else setStatus('Coins 0 · Reach the top platform');
  }
  function handlePixelKey(key) {
    const p = gameState.player;
    if (['ArrowLeft', 'a', 'A'].includes(key)) p.vx = -220;
    else if (['ArrowRight', 'd', 'D'].includes(key)) p.vx = 220;
    else if (['ArrowUp', ' '].includes(key) && p.onGround) { p.vy = -440; p.onGround = false; }
  }
  document.addEventListener('keyup', (event) => {
    if (currentGame === 'pixel' && ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) gameState.player.vx = 0;
    if (currentGame === 'runner' && ['ArrowDown', 's', 'S'].includes(event.key)) gameState.player.sliding = false;
    if (currentGame === 'bots') {
      const dirs = { a: ['one', 'x', -1], A: ['one', 'x', -1], d: ['one', 'x', 1], D: ['one', 'x', 1], w: ['one', 'y', -1], W: ['one', 'y', -1], s: ['one', 'y', 1], S: ['one', 'y', 1], ArrowLeft: ['two', 'x', -1], ArrowRight: ['two', 'x', 1], ArrowUp: ['two', 'y', -1], ArrowDown: ['two', 'y', 1] };
      const direction = dirs[event.key];
      if (direction && gameState) gameState[direction[0]][direction[1]] = 0;
    }
  });
  function initializeSignal() {
    const size = 9, mineCount = 10;
    const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ mine: false, revealed: false, flag: false, count: 0 })));
    let placed = 0;
    while (placed < mineCount) {
      const x = Math.floor(Math.random() * size), y = Math.floor(Math.random() * size);
      if (!cells[y][x].mine) { cells[y][x].mine = true; placed++; }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      cells[y][x].count = cells.slice(Math.max(0, y - 1), y + 2).flatMap((row) => row.slice(Math.max(0, x - 1), x + 2)).filter((cell) => cell.mine).length;
    }
    gameState = { cells, size, mineCount, flags: 0, over: false, won: false };
    setStatus('Signals hidden · 10 flags available · 0 safe tiles revealed');
    addSelect('Signal board size', [['6', 'Easy · 6 × 6'], ['9', 'Normal · 9 × 9'], ['12', 'Expert · 12 × 12'], ['custom', 'Custom board…']], '9', (value) => {
      customSize.hidden = value !== 'custom';
      createCustom.hidden = value !== 'custom';
      if (value !== 'custom') createSignal(Number(value));
    });
    const customSize = document.createElement('input');
    customSize.type = 'number'; customSize.min = '5'; customSize.max = '16'; customSize.value = '10'; customSize.hidden = true;
    customSize.setAttribute('aria-label', 'Custom board size from 5 to 16');
    const createCustom = make('button', '', 'Create custom board');
    createCustom.type = 'button'; createCustom.hidden = true;
    createCustom.addEventListener('click', () => {
      const size = Number(customSize.value);
      if (!Number.isInteger(size) || size < 5 || size > 16) { setStatus('Choose a custom board size from 5 to 16.'); return; }
      createSignal(size);
    });
    controls.append(customSize, createCustom);
  }
  function createSignal(size) {
    const mineCount = Math.max(5, Math.floor(size * size * 0.13));
    const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ mine: false, revealed: false, flag: false, count: 0 })));
    let placed = 0;
    while (placed < mineCount) {
      const x = Math.floor(Math.random() * size), y = Math.floor(Math.random() * size);
      if (!cells[y][x].mine) { cells[y][x].mine = true; placed++; }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) cells[y][x].count = cells.slice(Math.max(0, y - 1), y + 2).flatMap((row) => row.slice(Math.max(0, x - 1), x + 2)).filter((cell) => cell.mine).length;
    gameState = { cells, size, mineCount, flags: 0, over: false, won: false };
    setStatus(`Signals hidden · ${mineCount} flags available`);
  }
  function signalClick(event) {
    if (currentGame !== 'signal' || !dialog.open || gameState.over) return;
    const rect = canvas.getBoundingClientRect();
    const cellSize = Math.min(40, Math.floor(Math.min((canvas.width - 40) / gameState.size, (canvas.height - 40) / gameState.size)));
    const ox = (canvas.width - cellSize * gameState.size) / 2, oy = (canvas.height - cellSize * gameState.size) / 2;
    const x = Math.floor(((event.clientX - rect.left) * canvas.width / rect.width - ox) / cellSize);
    const y = Math.floor(((event.clientY - rect.top) * canvas.height / rect.height - oy) / cellSize);
    if (x < 0 || y < 0 || x >= gameState.size || y >= gameState.size) return;
    const cell = gameState.cells[y][x];
    if (event.button === 2) { event.preventDefault(); if (!cell.revealed) { cell.flag = !cell.flag; gameState.flags += cell.flag ? 1 : -1; } }
    else if (!cell.flag) revealSignal(x, y);
  }
  canvas.addEventListener('click', (event) => {
    if (currentGame !== 'pixel' || !dialog.open || !gameState.editing) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) * canvas.width / rect.width) / 20) * 20;
    const y = Math.round(((event.clientY - rect.top) * canvas.height / rect.height) / 20) * 20;
    if (gameState.platforms.length >= 17) { setStatus('This level is full. Remove a platform before adding another.'); return; }
    if (y < 40 || y > 390) { setStatus('Place platforms between the top and the ground.'); return; }
    gameState.platforms.push([Math.max(0, Math.min(720, x - 40)), y, 80, 12]);
    setStatus(`${gameState.platforms.length - 1}/16 platforms · click to keep building`);
  });
  canvas.addEventListener('pointerdown', signalClick);
  canvas.addEventListener('contextmenu', (event) => { if (currentGame === 'signal') event.preventDefault(); });
  function revealSignal(x, y) {
    const s = gameState, cell = s.cells[y][x];
    if (cell.revealed || cell.flag || s.over) return;
    cell.revealed = true;
    if (cell.mine) { s.over = true; setStatus('Signal hit! Restart for a new board.'); return; }
    if (cell.count === 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < s.size && ny >= 0 && ny < s.size) revealSignal(nx, ny);
    }
    const safe = s.cells.flat().filter((tile) => !tile.mine && tile.revealed).length;
    if (safe === s.size * s.size - s.mineCount) { s.won = true; s.over = true; setStatus('All clear! Signal sweep complete.'); }
    else setStatus(`${safe} safe tiles revealed · ${s.flags}/${s.mineCount} flags`);
  }

  function initializeBots() {
    const ai = botsOpponent === 'ai';
    gameState = { one: { x: 240, y: 225, vx: 0, vy: 0, lives: 3, color: '#ff4f9a' }, two: { x: 560, y: 225, vx: 0, vy: 0, lives: 3, color: '#72d8ff' }, time: 0, over: false, ai };
    if (!controls.querySelector('select')) addSelect('Opponent', [['ai', 'Play against AI'], ['local', 'Two players · same keyboard']], ai ? 'ai' : 'local', (value) => { botsOpponent = value; gameState.ai = value === 'ai'; });
    setStatus('Three bump-outs each · Last bot in the arena wins');
  }
  function handleBotsKey(key) {
    if (!gameState || gameState.over) return;
    const directions = { a: ['one', -1, 0], A: ['one', -1, 0], d: ['one', 1, 0], D: ['one', 1, 0], w: ['one', 0, -1], W: ['one', 0, -1], s: ['one', 0, 1], S: ['one', 0, 1], ArrowLeft: ['two', -1, 0], ArrowRight: ['two', 1, 0], ArrowUp: ['two', 0, -1], ArrowDown: ['two', 0, 1] };
    const [which, dx, dy] = directions[key] || [];
    if (which === 'two' && gameState.ai) return;
    if (which) { gameState[which].vx = dx * 250; gameState[which].vy = dy * 250; }
  }

  function initializeDrive() {
    gameState = { drive: { x: 400, y: 225, vx: 0, vy: 0, angle: 0, color: randomColor(), room: null, key: null, keyBytes: null, cursor: 0, remote: null, poller: null, sender: null, sending: false, driverId: b64(crypto.getRandomValues(new Uint8Array(8))) }, chat: [] };
    const drive = gameState.drive;
    const joinArea = make('div', 'game-chat');
    const name = document.createElement('input'); name.maxLength = 24; name.placeholder = 'Driver name'; name.setAttribute('aria-label', 'Driver name');
    const roomCode = document.createElement('input'); roomCode.placeholder = 'Paste a private room invite URL'; roomCode.setAttribute('aria-label', 'Private room invite URL');
    const create = make('button', '', 'Create room'); create.type = 'button';
    const join = make('button', '', 'Join'); join.type = 'button';
    const share = make('button', '', 'Copy invite'); share.type = 'button';
    joinArea.append(name, roomCode, create, join, share);
    const chatline = make('div', 'game-chat');
    const message = document.createElement('input'); message.maxLength = 500; message.placeholder = 'Chat with drivers in the room'; message.setAttribute('aria-label', 'Chat message');
    const send = make('button', '', 'Send'); send.type = 'button';
    chatline.append(message, send);
    controls.append(joinArea, chatline);
    create.addEventListener('click', async () => {
      const room = b64(crypto.getRandomValues(new Uint8Array(8)));
      const keyBytes = crypto.getRandomValues(new Uint8Array(32));
      try { await joinDrive(room, b64(keyBytes), keyBytes); }
      catch (error) { setStatus(`Could not create room: ${error.message}`); return; }
      try { await navigator.clipboard.writeText(location.href); setStatus('Private room created and invite copied. Share it to meet a friend.'); }
      catch { setStatus('Room created. Use Copy invite to share the private room.'); }
    });
    join.addEventListener('click', async () => {
      const value = roomCode.value.trim() || roomCodeFromLocation();
      const parsed = parseDriveInvite(value);
      if (!parsed.room || !parsed.key) { setStatus('Paste a private room invite URL with its #key.'); return; }
      try { await joinDrive(parsed.room, parsed.key); }
      catch (error) { setStatus(error.message); }
    });
    share.addEventListener('click', async () => {
      if (!drive.room) { setStatus('Create or join a room first.'); return; }
      try { await navigator.clipboard.writeText(location.href); setStatus('Private room invite copied.'); }
      catch (error) { setStatus(`Could not copy invite: ${error.message}`); }
    });
    const sendChat = async () => {
      const text = message.value.trim();
      if (!text) return;
      try { await sendDriveMessage({ kind: 'chat', name: name.value.trim() || 'Driver', text }); message.value = ''; }
      catch (error) { setStatus(`Chat message failed: ${error.message}`); }
    };
    send.addEventListener('click', sendChat);
    message.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendChat(); });
    if (new URLSearchParams(location.search).has('room') && location.hash.length > 1) roomCode.value = location.href;
  }
  function roomCodeFromLocation() {
    const params = new URLSearchParams(location.search);
    return params.get('room') ? location.href : '';
  }
  function parseDriveInvite(value) {
    try {
      const url = new URL(value, location.href);
      return { room: url.searchParams.get('room'), key: url.hash.slice(1) };
    } catch {
      return { room: value, key: '' };
    }
  }
  async function joinDrive(room, keyValue, keyBytes) {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(room)) throw new Error('That room code is not valid.');
    const bytes = keyBytes || unb64(keyValue);
    if (bytes.length !== 32) throw new Error('The invite is missing its encryption key.');
    const drive = gameState.drive;
    if (drive.poller) clearInterval(drive.poller);
    if (drive.sender) clearInterval(drive.sender);
    drive.room = room;
    drive.keyBytes = bytes;
    drive.key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
    drive.cursor = 0;
    drive.remote = null;
    history.replaceState(null, '', `?room=${encodeURIComponent(room)}#${b64(bytes)}`);
    await pollDrive();
    drive.poller = setInterval(pollDrive, 1000);
    drive.sender = setInterval(sendDrivePosition, 1200);
    setStatus(`Encrypted Olyra Chat room ${room.slice(0, 6)} · driver state shared privately`);
  }
  async function sendDriveMessage(payload) {
    const drive = gameState?.drive;
    if (!drive?.room || !drive.key) throw new Error('Create or join a room first.');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, drive.key, encoder.encode(JSON.stringify({ ...payload, driverId: drive.driverId })));
    const response = await fetch(chatApi, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room: drive.room, iv: b64(iv), data: b64(new Uint8Array(encrypted)) }) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'The Olyra Chat service did not accept the message.');
    }
  }
  async function sendDrivePosition() {
    if (!gameState?.drive?.room || gameState.drive.sending) return;
    gameState.drive.sending = true;
    try {
      const drive = gameState.drive;
      await sendDriveMessage({ kind: 'car', x: Math.round(drive.x), y: Math.round(drive.y), angle: drive.angle, color: drive.color, sentAt: Date.now() });
    } catch (error) {
      setStatus(`Multiplayer reconnecting: ${error.message}`);
    } finally {
      if (gameState?.drive) gameState.drive.sending = false;
    }
  }
  async function pollDrive() {
    const drive = gameState?.drive;
    if (!drive?.room) return;
    try {
      const response = await fetch(`${chatApi}?room=${encodeURIComponent(drive.room)}&since=${drive.cursor}`);
      if (!response.ok) throw new Error('Olyra Chat room could not be reached.');
      const messages = await response.json();
      for (const item of messages) {
        drive.cursor = Math.max(drive.cursor, item.id);
        try {
          const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(item.iv) }, drive.key, unb64(item.data));
          const payload = JSON.parse(decoder.decode(plain));
          if (payload.driverId === drive.driverId) continue;
          if (payload.kind === 'car' && Number.isFinite(payload.x) && payload.x >= 0 && payload.x <= 800 && Number.isFinite(payload.y) && payload.y >= 0 && payload.y <= 450 && Number.isFinite(payload.angle) && /^#[0-9a-f]{6}$/i.test(payload.color) && Number.isFinite(payload.sentAt) && Date.now() - payload.sentAt < 7000) drive.remote = payload;
          if (payload.kind === 'chat' && typeof payload.text === 'string' && payload.text.length <= 500) {
            gameState.chat.push(`${String(payload.name || 'Driver').slice(0, 24)}: ${payload.text}`);
            gameState.chat = gameState.chat.slice(-4);
          }
        } catch (error) {
          console.warn('Skipped a message that could not be decrypted in this game room.', error);
        }
      }
    } catch (error) {
      setStatus(`Multiplayer reconnecting: ${error.message}`);
    }
  }

  function initializeSpace() {
    gameState = { bodies: newOrbitBodies(), gravity: 1, running: true, requestInFlight: false, lastRequest: 0, lastStats: null, revision: 0 };
    addSelect('Gravity strength', [['0.25', 'Low gravity'], ['0.5', 'Gentle gravity'], ['1', 'Earth-like gravity'], ['1.5', 'High gravity'], ['2', 'Extreme gravity']], '1', (value) => { gameState.gravity = Number(value); gameState.revision++; });
    addControl('Add planet', () => addSpaceBody(18, 8));
    addControl('Add object', () => addSpaceBody(2, 4));
    addControl('Replace last with planet', () => replaceLastSpaceBody(18, 8));
    addControl('Replace last with object', () => replaceLastSpaceBody(2, 4));
    addControl('Remove last', () => { if (gameState.bodies.length > 1) { gameState.bodies.pop(); gameState.revision++; } });
    addControl('Reset system', () => { gameState.bodies = newOrbitBodies(); gameState.revision++; });
    const pause = addControl('Pause simulation', () => {
      gameState.running = !gameState.running;
      gameState.revision++;
      pause.textContent = gameState.running ? 'Pause simulation' : 'Resume simulation';
      setStatus(gameState.running ? 'Simulation resumed.' : 'Simulation paused.');
    });
    setStatus('Connecting to bounded backend gravity simulation…');
  }
  function addSpaceBody(mass, radius) {
    if (gameState.bodies.length >= 24) { setStatus('The model is limited to 24 objects to keep simulation work bounded.'); return; }
    gameState.bodies.push({ x: random(100, 700), y: random(75, 375), vx: random(-4, 4), vy: random(-4, 4), mass, radius, color: randomColor() });
    gameState.revision++;
  }
  function replaceLastSpaceBody(mass, radius) {
    if (gameState.bodies.length < 2) { setStatus('The central star cannot be replaced. Add an object first.'); return; }
    const body = gameState.bodies.at(-1);
    Object.assign(body, { mass, radius, color: randomColor(), vx: random(-4, 4), vy: random(-4, 4) });
    gameState.revision++;
  }
  async function requestSpaceStep(now) {
    const s = gameState;
    if (!s?.running || s.requestInFlight || now - s.lastRequest < 190) return;
    s.requestInFlight = true;
    s.lastRequest = now;
    const revision = s.revision;
    try {
      const response = await fetch('/api/games/space', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gravity: s.gravity, steps: 4, dt: 0.04, bodies: s.bodies })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The gravity service could not simulate this system.');
      if (s.revision === revision) {
        s.bodies = result.bodies;
        s.lastStats = result.stats;
        setStatus(`${result.stats.bodyCount} objects · gravity ${s.gravity.toFixed(2)}× · energy ${result.stats.energy.toFixed(1)} · simulated by Olyra`);
      }
    } catch (error) {
      console.error('Space Solution gravity request failed.', error);
      if (gameState === s) setStatus(`Backend simulation unavailable: ${error.message}`);
    } finally {
      if (gameState === s) s.requestInFlight = false;
    }
  }

  function initializeDriveWorld(dt) {
    const d = gameState.drive;
    if (['ArrowUp', 'w', 'W'].some((key) => pressedKeys.has(key))) { d.vx += Math.sin(d.angle) * 380 * dt; d.vy -= Math.cos(d.angle) * 380 * dt; }
    if (['ArrowDown', 's', 'S'].some((key) => pressedKeys.has(key))) { d.vx -= Math.sin(d.angle) * 230 * dt; d.vy += Math.cos(d.angle) * 230 * dt; }
    if (['ArrowLeft', 'a', 'A'].some((key) => pressedKeys.has(key))) d.angle -= 2.5 * dt;
    if (['ArrowRight', 'd', 'D'].some((key) => pressedKeys.has(key))) d.angle += 2.5 * dt;
    d.x = Math.max(22, Math.min(778, d.x + d.vx * dt));
    d.y = Math.max(22, Math.min(428, d.y + d.vy * dt));
    const friction = Math.pow(0.96, dt * 60);
    d.vx *= friction; d.vy *= friction;
  }
  const pressedKeys = new Set();
  document.addEventListener('keydown', (event) => {
    if (dialog.open && !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) pressedKeys.add(event.key);
  });
  document.addEventListener('keyup', (event) => pressedKeys.delete(event.key));
  window.addEventListener('blur', () => pressedKeys.clear());

  function loop(now) {
    if (!dialog.open || !gameState) return;
    const dt = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt, now);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function update(dt, now) {
    const s = gameState;
    if (currentGame === 'drive') {
      initializeDriveWorld(dt);
    }
    if (currentGame === 'stars' && !s.over) {
      s.time += dt; s.spawn += dt;
      if (s.spawn > Math.max(0.22, 0.75 - s.time * 0.012)) { s.spawn = 0; s.entities.push({ x: random(25, 775), y: -20, speed: random(95, 160) + s.time * 3, type: Math.random() < 0.7 ? 'star' : 'meteor' }); }
      for (const entity of s.entities) entity.y += entity.speed * dt;
      for (const entity of s.entities) if (!entity.hit && Math.abs(entity.x - s.player.x) < 25 && Math.abs(entity.y - s.player.y) < 24) {
        entity.hit = true;
        if (entity.type === 'star') s.score += 10;
        else { s.lives--; if (!s.lives) s.over = true; }
      }
      s.entities = s.entities.filter((entity) => entity.y < 470 && !entity.hit);
      scoreText(`Score ${s.score} · Lives ${s.lives} · Best ${storedBest('olyra-star-best', s.score)}`);
    }
    if (currentGame === 'runner' && !s.over) {
      s.time += dt; s.score = Math.floor(s.time * 10); s.speed = 240 + s.time * 12; s.spawn += dt;
      s.player.vy += 1200 * dt; // Gravity pulls the runner back down after jumping.
      s.player.y += s.player.vy * dt;
      if (s.player.y >= 355) { s.player.y = 355; s.player.vy = 0; s.player.jumping = false; }
      if (s.player.sliding) { s.player.slideTime -= dt; if (s.player.slideTime <= 0) s.player.sliding = false; }
      if (s.spawn > Math.max(0.42, 1.2 - s.time * 0.015)) { s.spawn = 0; s.obstacles.push({ x: 840, type: Math.random() < 0.5 ? 'jump' : 'slide' }); }
      for (const obstacle of s.obstacles) obstacle.x -= s.speed * dt;
      for (const obstacle of s.obstacles) {
        const overlaps = obstacle.x > 88 && obstacle.x < 145;
        if (overlaps && ((obstacle.type === 'jump' && s.player.y > 325) || (obstacle.type === 'slide' && !s.player.sliding))) s.over = true;
      }
      s.obstacles = s.obstacles.filter((obstacle) => obstacle.x > -50);
      setStatus(`Distance ${s.score} m · Speed ${(s.speed / 240).toFixed(1)}×${s.over ? ' · crashed' : ''}`);
    }
    if (currentGame === 'blocks') {
      setStatus(`Score ${s.score}${s.over ? ' · board full' : ''}`);
    }
    if (currentGame === 'orbit' && !s.over) updateOrbit(dt);
    if (currentGame === 'beat' && s.started) {
      s.time += dt;
      if (s.time >= s.next) { s.notes.push({ key: s.pattern[s.patternIndex % s.pattern.length], x: 820 }); s.patternIndex++; s.next += 0.82; }
      for (const note of s.notes) note.x -= 300 * dt;
      const missed = s.notes.filter((note) => note.x < 60);
      s.misses += missed.length;
      if (missed.length) { s.notes = s.notes.filter((note) => note.x >= 60); s.combo = 0; }
      setStatus(`${s.score} points · ${s.combo} combo · ${s.misses} misses`);
    }
    if (currentGame === 'pixel') updatePixel(dt);
    if (currentGame === 'bots') updateBots(dt);
    if (currentGame === 'space') requestSpaceStep(now);
  }
  function updateOrbit(dt) {
    const s = gameState, bodies = s.bodies;
    s.time += dt;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue;
        const b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 900;
        const acceleration = s.gravity * b.mass / d2;
        a.vx += dx * acceleration * dt;
        a.vy += dy * acceleration * dt;
      }
    }
    for (const body of bodies) {
      body.x += body.vx * dt; body.y += body.vy * dt;
      if (body.x < body.radius || body.x > 800 - body.radius) body.vx *= -0.8;
      if (body.y < body.radius || body.y > 450 - body.radius) body.vy *= -0.8;
      body.x = Math.max(body.radius, Math.min(800 - body.radius, body.x));
      body.y = Math.max(body.radius, Math.min(450 - body.radius, body.y));
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      if (Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y) <= bodies[i].radius + bodies[j].radius) {
        s.over = true;
        setStatus('Planet collision! Reset the system to try a new orbit.');
      }
    }
  }
  function updatePixel(dt) {
    const p = gameState.player;
    p.vy += 980 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.onGround = false;
    for (const [x, y, width, height] of gameState.platforms) {
      if (p.vy >= 0 && p.x + 20 > x && p.x < x + width && p.y + 24 >= y && p.y + 24 - p.vy * dt <= y) { p.y = y - 24; p.vy = 0; p.onGround = true; }
    }
    p.x = Math.max(0, Math.min(780, p.x));
    gameState.coins = gameState.coins.filter(([x, y]) => {
      if (Math.abs(p.x - x) < 22 && Math.abs(p.y - y) < 26) { gameState.score += 1; return false; }
      return true;
    });
    if (p.y > 460) { p.x = 50; p.y = 330; p.vy = 0; }
    if (gameState.score === 4) gameState.won = true;
    setStatus(`Coins ${gameState.score}/4${gameState.won ? ' · level complete!' : ''}`);
  }
  function updateBots(dt) {
    const s = gameState;
    if (s.over) return;
    s.time += dt;
    for (const bot of [s.one, s.two]) {
      bot.x += bot.vx * dt; bot.y += bot.vy * dt; bot.vx *= 0.97; bot.vy *= 0.97;
      if (bot.x < 55 || bot.x > 745 || bot.y < 55 || bot.y > 395) { bot.lives--; bot.x = bot.x < 400 ? 220 : 580; bot.y = 225; bot.vx = 0; bot.vy = 0; }
    }
    if (s.ai) {
      const dx = s.one.x - s.two.x, dy = s.one.y - s.two.y, distance = Math.hypot(dx, dy) || 1;
      s.two.vx += dx / distance * 100 * dt;
      s.two.vy += dy / distance * 100 * dt;
    }
    const dx = s.two.x - s.one.x, dy = s.two.y - s.one.y, distance = Math.hypot(dx, dy);
    if (distance < 42 && distance > 0) { s.one.vx -= dx / distance * 18; s.one.vy -= dy / distance * 18; s.two.vx += dx / distance * 18; s.two.vy += dy / distance * 18; }
    if (s.one.lives <= 0 || s.two.lives <= 0) s.over = true;
    setStatus(`Pink bot ${Math.max(0, s.one.lives)} bumps · Blue bot ${Math.max(0, s.two.lives)} bumps${s.over ? (s.one.lives > s.two.lives ? ' · pink wins!' : ' · blue wins!') : ''}`);
  }
  function handleRunnerKey(key) {
    if (currentGame !== 'runner' || gameState.over) return;
    if ([' ', 'ArrowUp', 'w', 'W'].includes(key) && !gameState.player.jumping && gameState.player.y >= 355) { gameState.player.vy = -430; gameState.player.jumping = true; }
    if (['ArrowDown', 's', 'S'].includes(key)) { gameState.player.sliding = true; gameState.player.slideTime = 0.6; }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentGame === 'drive') drawDrive();
    if (currentGame === 'stars') drawStars();
    if (currentGame === 'runner') drawRunner();
    if (currentGame === 'blocks') drawBlocks();
    if (currentGame === 'orbit') drawOrbit();
    if (currentGame === 'maze') drawMaze();
    if (currentGame === 'beat') drawBeat();
    if (currentGame === 'colony') drawColony();
    if (currentGame === 'pixel') drawPixel();
    if (currentGame === 'signal') drawSignal();
    if (currentGame === 'bots') drawBots();
    if (currentGame === 'space') drawSpace();
  }
  function drawDrive() {
    const d = gameState.drive;
    ctx.fillStyle = '#111829'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#26344c'; ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke(); }
    for (let y = 0; y < 450; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    ctx.strokeStyle = '#4b576f'; ctx.setLineDash([15, 12]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(400, 225, 305, 155, -0.16, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawCar(d.x, d.y, d.angle, d.color);
    if (d.remote) drawCar(d.remote.x, d.remote.y, d.remote.angle, d.remote.color || '#72d8ff');
    ctx.fillStyle = '#aaa5c2'; ctx.font = '12px monospace'; ctx.fillText(d.remote ? 'FRIEND ONLINE' : d.room ? 'WAITING FOR A DRIVER…' : 'CREATE A ROOM TO INVITE A FRIEND', 20, 28);
    if (gameState.chat.length) { ctx.fillStyle = '#f7f2ff'; ctx.font = '12px monospace'; gameState.chat.forEach((line, i) => ctx.fillText(line.slice(0, 80), 20, 392 + i * 14)); }
  }
  function drawCar(x, y, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#080812'; ctx.fillRect(-12, -18, 24, 36);
    ctx.fillStyle = color; ctx.fillRect(-10, -16, 20, 32);
    ctx.fillStyle = '#b9edff'; ctx.fillRect(-7, -7, 14, 8);
    ctx.fillStyle = '#ffe48a'; ctx.fillRect(-7, -15, 5, 3); ctx.fillRect(2, -15, 5, 3);
    ctx.restore();
  }
  function drawStars() {
    const s = gameState;
    ctx.fillStyle = '#090914'; ctx.fillRect(0, 0, 800, 450);
    for (let i = 0; i < 42; i++) { ctx.fillStyle = i % 3 ? '#77708f' : '#fff3bf'; ctx.fillRect((i * 197) % 800, (i * 83 + s.time * 22) % 450, 2, 2); }
    for (const entity of s.entities) { ctx.fillStyle = entity.type === 'star' ? '#ffe48a' : '#ff697b'; ctx.font = '24px sans-serif'; ctx.fillText(entity.type === 'star' ? '✦' : '☄', entity.x, entity.y); }
    ctx.fillStyle = s.player.color; ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y - 20); ctx.lineTo(s.player.x - 16, s.player.y + 15); ctx.lineTo(s.player.x, s.player.y + 8); ctx.lineTo(s.player.x + 16, s.player.y + 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f7f2ff'; ctx.font = '13px monospace'; ctx.fillText(`✦ ${s.score}     ♥ ${s.lives}`, 18, 28);
    if (s.over) centerText('MISSION OVER', 'Press Restart to fly again');
  }
  function drawRunner() {
    const s = gameState;
    ctx.fillStyle = '#101124'; ctx.fillRect(0, 0, 800, 450);
    for (let x = 0; x < 800; x += 80) { ctx.fillStyle = '#18253c'; ctx.fillRect(x + (s.time * s.speed * 0.15) % 80, 80, 2, 265); }
    ctx.fillStyle = '#38224f'; ctx.fillRect(0, 380, 800, 70); ctx.fillStyle = '#ff4f9a'; ctx.fillRect(0, 378, 800, 3);
    ctx.fillStyle = '#72d8ff'; ctx.fillRect(95, s.player.sliding ? 340 : s.player.y - 25, 28, s.player.sliding ? 18 : 25);
    for (const obstacle of s.obstacles) {
      ctx.fillStyle = obstacle.type === 'jump' ? '#ff4f9a' : '#b184ff';
      if (obstacle.type === 'jump') ctx.fillRect(obstacle.x, 338, 28, 40);
      else ctx.fillRect(obstacle.x, 324, 48, 12);
    }
    ctx.fillStyle = '#f7f2ff'; ctx.font = '13px monospace'; ctx.fillText(`${s.score} M`, 20, 28);
    if (s.over) centerText('END OF THE ROAD', 'Press Restart for another run');
  }
  function drawBlocks() {
    const s = gameState, size = 19, ox = 305, oy = 32;
    ctx.fillStyle = '#101020'; ctx.fillRect(0, 0, 800, 450);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) drawTile(ox + x * size, oy + y * size, size - 1, s.grid[y][x] || '#19182a');
    if (s.piece) s.piece.shape.forEach((row, dy) => row.forEach((cell, dx) => { if (cell) drawTile(ox + (s.piece.x + dx) * size, oy + (s.piece.y + dy) * size, size - 1, s.piece.color); }));
    ctx.fillStyle = '#f7f2ff'; ctx.font = '14px monospace'; ctx.fillText(`SCORE ${s.score}`, 535, 80); ctx.fillText('10 × 20', 535, 105);
    if (s.over) centerText('BOARD FULL', 'Press Restart to play again');
  }
  function drawTile(x, y, size, color) { ctx.fillStyle = color; ctx.fillRect(x, y, size, size); ctx.strokeStyle = '#111020'; ctx.strokeRect(x, y, size, size); }
  function drawOrbit() {
    const s = gameState;
    ctx.fillStyle = '#090914'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#aaa5c2'; ctx.font = '12px monospace'; ctx.fillText('CLICK TO ADD A PLANET', 18, 25); ctx.fillText(`GRAVITY ${s.gravity}`, 650, 25);
    for (const body of s.bodies) { ctx.beginPath(); ctx.strokeStyle = `${body.color}55`; ctx.arc(body.x, body.y, Math.max(28, Math.hypot(body.vx, body.vy) * 2), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawMaze() {
    const s = gameState, cell = 40, ox = 140, oy = 42;
    ctx.fillStyle = '#0d1020'; ctx.fillRect(0, 0, 800, 450);
    for (let y = 0; y < s.cells.length; y++) for (let x = 0; x < s.cells[y].length; x++) {
      const walls = s.cells[y][x].walls, left = ox + x * cell, top = oy + y * cell;
      ctx.strokeStyle = '#53607f'; ctx.lineWidth = 2; ctx.beginPath();
      if (walls[0]) { ctx.moveTo(left, top); ctx.lineTo(left + cell, top); }
      if (walls[1]) { ctx.moveTo(left + cell, top); ctx.lineTo(left + cell, top + cell); }
      if (walls[2]) { ctx.moveTo(left, top + cell); ctx.lineTo(left + cell, top + cell); }
      if (walls[3]) { ctx.moveTo(left, top); ctx.lineTo(left, top + cell); }
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe48a'; if (s.treasure[0] >= 0) ctx.fillText('◆', ox + s.treasure[0] * cell + 14, oy + s.treasure[1] * cell + 26);
    ctx.fillStyle = s.hasKey ? '#a2edb4' : '#ff4f9a'; ctx.fillText(s.hasKey ? '✓' : '⚿', ox + s.key[0] * cell + 14, oy + s.key[1] * cell + 26);
    ctx.fillStyle = '#72d8ff'; ctx.fillText('⇧', ox + s.exit[0] * cell + 14, oy + s.exit[1] * cell + 26);
    ctx.fillStyle = '#ff9f73'; ctx.fillText('◆', ox + s.enemy[0] * cell + 14, oy + s.enemy[1] * cell + 26);
    ctx.fillStyle = '#ff4f9a'; ctx.beginPath(); ctx.arc(ox + s.x * cell + 20, oy + s.y * cell + 20, 8, 0, Math.PI * 2); ctx.fill();
    if (s.won) centerText('MAZE ESCAPED', 'A new maze awaits · press Restart');
    if (s.lost) centerText('CAUGHT!', 'The roaming bot found you · press Restart');
  }
  function drawBeat() {
    const s = gameState;
    ctx.fillStyle = '#110d1b'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#51405d'; ctx.setLineDash([5, 7]); for (let i = 0; i < 4; i++) { const x = 195 + i * 130; ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x, 360); ctx.stroke(); ctx.fillStyle = '#ffb7e1'; ctx.font = '18px monospace'; ctx.fillText(s.keys[i].toUpperCase(), x - 5, 390); } ctx.setLineDash([]);
    ctx.strokeStyle = '#ffe48a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(120, 90); ctx.lineTo(120, 360); ctx.stroke(); ctx.lineWidth = 1;
    for (const note of s.notes) { const lane = s.keys.indexOf(note.key); ctx.fillStyle = ['#ff4f9a', '#72d8ff', '#ffe48a', '#a2edb4'][lane]; ctx.beginPath(); ctx.arc(note.x, 145 + lane * 55, 13, 0, Math.PI * 2); ctx.fill(); }
    if (!s.started) centerText('READY?', 'Press Start beat, then D F J K');
  }
  function drawColony() {
    const s = gameState;
    ctx.fillStyle = '#0d151b'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#192a37'; ctx.beginPath(); ctx.ellipse(400, 385, 310, 80, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#72d8ff'; ctx.beginPath(); ctx.arc(650, 82, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#18252d'; ctx.fillRect(260, 310, 150, 76); ctx.fillRect(430, 280, 95, 106);
    if (s.labs) { ctx.fillStyle = '#344055'; ctx.fillRect(150, 320, 85, 66); }
    if (s.observatories) { ctx.fillStyle = '#4a405e'; ctx.fillRect(555, 290, 80, 96); }
    ctx.fillStyle = '#a2edb4'; ctx.fillRect(280, 328, 30, 30); ctx.fillRect(325, 328, 30, 30); ctx.fillRect(450, 300, 24, 25); ctx.fillRect(487, 300, 24, 25);
    for (let i = 0; i < s.people; i++) { ctx.fillStyle = ['#ff4f9a', '#ffe48a', '#b184ff'][i % 3]; ctx.beginPath(); ctx.arc(220 + i * 36, 355, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f7f2ff'; ctx.font = '15px monospace'; ctx.fillText(`DAY ${s.day}`, 25, 36); ctx.fillText(`HAPPINESS ${s.happiness}%`, 25, 63);
    ctx.fillStyle = '#a2edb4'; ctx.fillRect(25, 75, Math.max(0, s.happiness) * 2.2, 8);
    for (let i = 0; i < Math.min(8, s.farms); i++) { ctx.fillStyle = '#a2edb4'; ctx.fillText('♧', 550 + i * 24, 357); }
  }
  function drawPixel() {
    const s = gameState;
    ctx.fillStyle = '#17122c'; ctx.fillRect(0, 0, 800, 450);
    for (const [x, y, width, height] of s.platforms) { ctx.fillStyle = '#493e70'; ctx.fillRect(x, y, width, height); ctx.fillStyle = '#72d8ff'; ctx.fillRect(x, y, width, 4); }
    for (const [x, y] of s.coins) { ctx.fillStyle = '#ffe48a'; ctx.fillRect(x, y, 12, 12); }
    ctx.fillStyle = '#ff4f9a'; ctx.fillRect(s.player.x, s.player.y, 20, 24);
    if (s.won) centerText('LEVEL COMPLETE', 'All coins collected!');
  }
  function drawSignal() {
    const s = gameState, size = Math.min(40, Math.floor(Math.min((canvas.width - 40) / s.size, (canvas.height - 40) / s.size)));
    const ox = (canvas.width - size * s.size) / 2, oy = (canvas.height - size * s.size) / 2;
    ctx.fillStyle = '#0a0d17'; ctx.fillRect(0, 0, 800, 450);
    const numbers = ['#72d8ff', '#a2edb4', '#ffe48a', '#ff9f73', '#ff4f9a', '#bd85ff', '#b184ff', '#f7f2ff'];
    for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) {
      const cell = s.cells[y][x], px = ox + x * size, py = oy + y * size;
      ctx.fillStyle = cell.revealed ? '#28283b' : '#30344d'; ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      if (cell.flag) { ctx.fillStyle = '#ff4f9a'; ctx.font = `${size - 9}px monospace`; ctx.fillText('⚑', px + size * 0.2, py + size * 0.78); }
      else if (cell.revealed && cell.mine) { ctx.fillStyle = '#ff4f9a'; ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, 7, 0, Math.PI * 2); ctx.fill(); }
      else if (cell.revealed && cell.count) { ctx.fillStyle = numbers[cell.count - 1]; ctx.font = `bold ${size - 10}px monospace`; ctx.fillText(String(cell.count), px + size * 0.32, py + size * 0.73); }
    }
  }
  function drawBots() {
    const s = gameState;
    ctx.fillStyle = '#100f1e'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#827c9c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(400, 225, 190, 0, Math.PI * 2); ctx.stroke();
    for (const [bot, label] of [[s.one, 'P1'], [s.two, 'P2']]) {
      ctx.fillStyle = bot.color; ctx.beginPath(); ctx.arc(bot.x, bot.y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#080812'; ctx.fillRect(bot.x - 10, bot.y - 5, 5, 5); ctx.fillRect(bot.x + 5, bot.y - 5, 5, 5);
      ctx.fillStyle = '#f7f2ff'; ctx.font = '10px monospace'; ctx.fillText(label === 'P2' && s.ai ? 'CPU' : label, bot.x - 10, bot.y + 34);
    }
    if (s.over) centerText('ARENA OVER', s.one.lives > s.two.lives ? 'Pink player wins!' : 'Blue player wins!');
  }
  function drawSpace() {
    const s = gameState;
    ctx.fillStyle = '#080812'; ctx.fillRect(0, 0, 800, 450);
    for (let i = 0; i < 75; i++) { ctx.fillStyle = i % 4 ? '#69627b' : '#e7d8ab'; ctx.fillRect((i * 101) % 800, (i * 61) % 450, 2, 2); }
    for (let i = 0; i < s.bodies.length; i++) {
      const body = s.bodies[i];
      ctx.strokeStyle = `${body.color}35`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(body.x, body.y, 32 + body.radius * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = body.color; ctx.beginPath(); ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2); ctx.fill();
      if (body.mass >= 100) { ctx.shadowColor = body.color; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0; }
      ctx.fillStyle = '#c9c3db'; ctx.font = '10px monospace'; ctx.fillText(body.mass >= 100 ? 'STAR' : `BODY ${i}`, body.x + body.radius + 4, body.y + 3);
    }
    ctx.fillStyle = '#aaa5c2'; ctx.font = '11px monospace'; ctx.fillText('SERVER-SIMULATED GRAVITY · LIMITED TO 24 OBJECTS', 16, 25);
  }
  function centerText(heading, subheading) {
    ctx.fillStyle = '#080812d9'; ctx.fillRect(175, 178, 450, 95);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f7f2ff'; ctx.font = 'bold 23px monospace'; ctx.fillText(heading, 400, 218);
    ctx.fillStyle = '#aaa5c2'; ctx.font = '12px monospace'; ctx.fillText(subheading, 400, 246); ctx.textAlign = 'left';
  }
})();
