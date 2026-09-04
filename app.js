const config = window.gameConfig || { rounds: 10, startingHealth: 100, defaultMode: 'solo', soloOpponent: 'Professor Robô' };
const state = { difficulty: 'easy', active: false, training: false, paused: false, question: null, questionIndex: 0, streak: 0, score: 0, correctAnswers: 0, playerHealth: config.startingHealth, opponentHealth: config.startingHealth, maxOpponentHealth: config.startingHealth, machineTimer: null, questionTimer: null, questionSeconds: 0, gameStartedAt: 0, sound: true, fontLarge: false };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function rankingEntries() { return JSON.parse(localStorage.getItem('contaCombateRanking') || '[]'); }
function saveRanking(name, time, game) {
  const entries = rankingEntries();
  entries.push({ name: name || 'Jogador 1', time: Math.max(1, Math.round(time)), game });
  entries.sort((first, second) => first.time - second.time);
  localStorage.setItem('contaCombateRanking', JSON.stringify(entries.slice(0, 20)));
}
function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function renderRanking(element, game) {
  if (!element) return;
  const entries = rankingEntries().filter((entry) => entry.game === game).slice(0, 3);
  element.innerHTML = `<div class="ranking-heading"><span class="ranking-kicker">RANKING</span><strong>Melhores tempos</strong></div>${entries.length ? `<ol>${entries.map((entry, index) => `<li class="ranking-place place-${index + 1}"><span class="ranking-crown" aria-label="${index + 1}º lugar">♛</span><span class="ranking-name">${escapeHTML(entry.name)}</span><time>${entry.time}s</time></li>`).join('')}</ol>` : '<p class="ranking-empty">Complete uma partida para entrar no ranking.</p>'}`;
}
async function toggleFullscreen(button) {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
  const active = Boolean(document.fullscreenElement);
  button.textContent = button.id === 'fullscreen-button' ? '⛶' : active ? '⛶ Sair da tela cheia' : '⛶ Tela cheia';
  button.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Ativar tela cheia');
}
document.addEventListener('fullscreenchange', () => {
  $$('#fullscreen-button, #memory-fullscreen').forEach((button) => {
    const active = Boolean(document.fullscreenElement);
    button.textContent = button.id === 'fullscreen-button' ? '⛶' : active ? '⛶ Sair da tela cheia' : '⛶ Tela cheia';
    button.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Ativar tela cheia');
  });
});
function setTheme(dark) {
  document.body.classList.toggle('dark-mode', dark);
  localStorage.setItem('contaCombateTheme', dark ? 'dark' : 'light');
  $$('#dark-mode-button, #library-dark-mode, #memory-dark, .home-theme').forEach((button) => {
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = dark ? 'Tema claro' : 'Tema escuro';
    if (button.id === 'dark-mode-button') button.textContent = dark ? '☀' : '☾';
    if (button.id === 'library-dark-mode' || button.id === 'memory-dark' || button.classList.contains('home-theme')) button.textContent = dark ? '☀ Tema claro' : '☾ Tema escuro';
  });
}
setTheme(localStorage.getItem('contaCombateTheme') === 'dark');

function createGameLibrary(nickname) {
  const existing = $('.game-library');
  if (existing) existing.remove();
  document.body.classList.add('library-active');
  const library = document.createElement('section');
  library.className = 'game-library';
  library.innerHTML = `<div class="library-card"><div class="library-top"><div><p class="eyebrow">BIBLIOTECA GUILF TECH</p><h1>Escolha sua missão</h1><p>Olá, ${nickname}! Qual desafio você quer jogar?</p></div><div class="library-top-actions"><button type="button" id="library-dark-mode" class="library-theme-button" aria-pressed="false">☾ Tema escuro</button><button type="button" class="library-close" aria-label="Fechar biblioteca">×</button></div></div><div class="library-games"><article class="library-game featured"><img src="assets/math-book.svg" alt="Livro de matemática"><div><span class="game-tag">JOGO PRINCIPAL</span><h2>Conta & Combate</h2><p>Resolva contas, ataque a máquina e conquiste a vitória.</p><button type="button" data-game="battle">Jogar agora <span>→</span></button></div></article><article class="library-game memory-game"><img src="assets/memory-cards.svg" alt="Cartas numéricas do jogo da memória"><div><span class="game-tag">JOGO SECUNDÁRIO</span><h2>Memória dos Números</h2><p>Encontre os pares de números iguais.</p><button type="button" data-game="memory">Jogar memória <span>→</span></button></div></article></div><div class="library-footer"><span>Seu progresso fica salvo neste navegador.</span><button type="button" class="account-library-button">Trocar conta</button></div></div>`;
  document.body.prepend(library);
  setTheme(document.body.classList.contains('dark-mode'));
  const close = () => { library.remove(); document.body.classList.remove('library-active'); };
  library.querySelector('.library-close').addEventListener('click', close);
  library.querySelector('#library-dark-mode').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  library.querySelector('[data-game="battle"]').addEventListener('click', close);
  library.querySelector('[data-game="memory"]').addEventListener('click', () => { close(); startMemoryGame(nickname); });
  library.querySelector('.account-library-button').addEventListener('click', () => { close(); createAuthScreen(); });
}

function createHomeScreen(nickname) {
  const existing = $('.home-screen');
  if (existing) existing.remove();
  document.body.classList.add('home-active');
  const home = document.createElement('section');
  home.className = 'home-screen';
  home.innerHTML = `<div class="home-card"><div class="home-heading"><img class="home-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><span class="home-brand-name">GUILF TECH <i>/</i> CONTA &amp; COMBATE</span></div><div class="home-intro"><p class="eyebrow">ARENA MATEMÁTICA</p><h1>Olá, ${escapeHTML(nickname)}!</h1><p class="home-motto">"Cada desafio é uma nova chance de mostrar o que você consegue."</p><p class="home-subtitle">Escolha sua aventura e dê o primeiro passo.</p></div><div class="home-games"><button type="button" class="home-game home-battle"><img src="assets/math-book.svg" alt=""><span><strong>Conta & Combate</strong><small>Resolva desafios e enfrente a máquina.</small></span><b>Jogar →</b></button><button type="button" class="home-game home-memory"><img src="assets/memory-cards.svg" alt=""><span><strong>Memória dos Números</strong><small>Encontre os pares antes do tempo acabar.</small></span><b>Jogar →</b></button></div><div class="home-actions"><button type="button" class="home-library">Ver biblioteca</button><button type="button" class="home-theme">☾ Tema escuro</button></div></div>`;
  document.body.prepend(home);
  const leave = () => { home.remove(); document.body.classList.remove('home-active'); };
  home.querySelector('.home-battle').addEventListener('click', leave);
  home.querySelector('.home-memory').addEventListener('click', () => { leave(); createGameLibrary(nickname); });
  home.querySelector('.home-library').addEventListener('click', () => { leave(); createGameLibrary(nickname); });
  home.querySelector('.home-theme').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
}

function startMemoryGame(nickname) {
  document.body.classList.add('memory-active');
  const overlay = document.createElement('section');
  overlay.className = 'memory-screen';
  overlay.innerHTML = `<div class="memory-card"><div class="memory-top-actions"><button type="button" id="memory-support" aria-pressed="false">♥ Modo de apoio</button><button type="button" id="memory-dark" aria-label="Ativar modo escuro">☾ Modo escuro</button><button type="button" id="memory-accessibility" aria-label="Ativar modo acessível">Aa Acessibilidade</button><button type="button" id="memory-account">Trocar conta</button></div><div class="memory-header"><div><span class="game-tag">MEMÓRIA DOS NÚMEROS</span><h1>Encontre os iguais!</h1><p>Vire duas cartas por vez e complete todos os pares antes do tempo acabar.</p></div><div class="memory-stats"><span class="memory-stat-time">Tempo <strong id="memory-time" aria-live="polite">60s</strong></span><span>Pares <strong id="memory-pairs">0/4</strong></span><span>Jogadas <strong id="memory-moves">0</strong></span><span>Pontos <strong id="memory-score">0</strong></span><span>Recorde <strong id="memory-best">0</strong></span></div></div><div class="memory-guide" aria-label="Instruções do jogo"><strong>Como jogar</strong><span><b>1</b> Vire uma carta</span><span><b>2</b> Vire outra carta</span><span><b>3</b> Encontre os números iguais</span><span><b>4</b> Complete todos os pares</span></div><div class="memory-difficulty"><span>Nível:</span><button type="button" class="memory-level active" data-memory-level="easy">Fácil <small>4 pares</small></button><button type="button" class="memory-level" data-memory-level="medium">Médio <small>6 pares</small></button><button type="button" class="memory-level" data-memory-level="hard">Difícil <small>8 pares</small></button></div><div class="memory-help"><strong>Dica</strong><span>Observe a posição das cartas e jogue com calma. Você pode recomeçar quando quiser.</span></div><div class="memory-game-actions"><button type="button" id="memory-play" class="memory-play-button">▶ Jogar</button><button type="button" id="memory-pause" disabled>Ⅱ Pausar</button><button type="button" id="memory-restart">↻ Reiniciar</button><button type="button" id="memory-menu">← Sair para o menu</button></div><div class="memory-motivation" aria-live="polite"><span aria-hidden="true">✦</span><strong id="memory-motivation">Você consegue! Observe bem as cartas.</strong></div><div id="memory-board" class="memory-board"></div><p id="memory-feedback" class="memory-feedback">Clique em Jogar para começar.</p><div id="memory-result" class="memory-result"></div><button type="button" id="memory-exit">Voltar à biblioteca</button></div>`;
  document.body.prepend(overlay);
  const memoryBrand = document.createElement('div');
  memoryBrand.className = 'memory-brand';
  memoryBrand.innerHTML = '<img src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><strong>GUILF TECH</strong><span>/ MEMÓRIA DOS NÚMEROS</span>';
  overlay.querySelector('.memory-card').prepend(memoryBrand);
    const memoryNameField = document.createElement('label');
    memoryNameField.className = 'memory-name-field';
    memoryNameField.innerHTML = '<span>Seu nome no ranking</span><input id="memory-player-name" type="text" maxlength="18" autocomplete="nickname">';
    memoryNameField.querySelector('input').value = nickname;
  overlay.querySelector('.memory-card').insertBefore(memoryNameField, overlay.querySelector('.memory-game-actions'));
  overlay.querySelector('#memory-accessibility').remove();
  const fullscreenButton = document.createElement('button');
  fullscreenButton.type = 'button';
  fullscreenButton.id = 'memory-fullscreen';
  fullscreenButton.className = 'memory-fullscreen-button';
  fullscreenButton.textContent = '⛶ Tela cheia';
  fullscreenButton.setAttribute('aria-label', 'Ativar tela cheia');
  fullscreenButton.addEventListener('click', () => toggleFullscreen(fullscreenButton));
  overlay.querySelector('.memory-top-actions').insertBefore(fullscreenButton, overlay.querySelector('#memory-account'));
  const playAgainButton = document.createElement('button');
  playAgainButton.type = 'button';
  playAgainButton.id = 'memory-play-again';
  playAgainButton.className = 'memory-play-again-bottom';
  playAgainButton.textContent = '↻ Jogar de novo';
  overlay.querySelector('#memory-exit').before(playAgainButton);
  const memoryRanking = document.createElement('section');
  memoryRanking.className = 'memory-ranking ranking-panel';
  overlay.querySelector('#memory-exit').before(memoryRanking);
  renderRanking(memoryRanking, 'memory');
  let memoryLevel = 'easy';
  const numbers = { easy: ['7', '12', '19', '24'], medium: ['7', '12', '19', '24', '31', '45'], hard: ['7', '12', '19', '24', '31', '45', '58', '73'] };
  let pairs = numbers[memoryLevel].map((value) => [value, value]);
  let firstCard = null; let locked = false; let matched = 0; let moves = 0; let score = 0; let memorySeconds = 60; let memoryTimer = null; let memoryStarted = false; let supportMode = false; let gameReady = false; let gamePaused = false; let rankingSaved = false; let memoryInitialSeconds = 60;
  const bestKey = 'contaCombateMemoryBest'; const bestScore = Number(localStorage.getItem(bestKey) || 0); $('#memory-best').textContent = bestScore;
  let cards;
  const board = $('#memory-board');
  const timeByLevel = { easy: 45, medium: 35, hard: 25 };
  const stopMemoryTimer = () => { clearInterval(memoryTimer); memoryTimer = null; };
  const updateMemoryTime = () => { $('#memory-time').textContent = `${memorySeconds}s`; $('#memory-time').parentElement.classList.toggle('urgent', memorySeconds <= 10); };
  const setMotivation = (message) => { $('#memory-motivation').textContent = message; };
  const getMemoryName = () => $('#memory-player-name').value.trim() || 'Jogador 1';
  const recordMemoryRanking = () => { if (rankingSaved) return; rankingSaved = true; saveRanking(getMemoryName(), memoryInitialSeconds - memorySeconds, 'memory'); renderRanking(memoryRanking, 'memory'); };
  const startMemoryTimer = () => { if (memoryStarted) return; memoryStarted = true; setMotivation('Respire fundo e confie na sua memória!'); memoryTimer = setInterval(() => { memorySeconds -= 1; updateMemoryTime(); if (memorySeconds <= 10 && memorySeconds > 0) setMotivation('Você ainda consegue! Foque em uma carta por vez.'); if (memorySeconds <= 0) { stopMemoryTimer(); locked = true; board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = true; }); $('#memory-feedback').textContent = 'O tempo acabou!'; $('#memory-feedback').className = 'memory-feedback error'; setMotivation('Tudo bem! Cada tentativa ajuda você a melhorar.'); $('#memory-result').innerHTML = `<strong>Fim de jogo</strong> Você encontrou ${matched} de ${pairs.length} pares.`; recordMemoryRanking(); playTone(150, 0.2); } }, 1000); };
  const setupBoard = () => {
    stopMemoryTimer(); memorySeconds = timeByLevel[memoryLevel] + (supportMode ? 30 : 0); memoryInitialSeconds = memorySeconds; memoryStarted = false; rankingSaved = false; pairs = numbers[memoryLevel].map((value) => [value, value]); matched = 0; moves = 0; score = 0; firstCard = null; locked = false; cards = pairs.flatMap(([first, second], index) => [{ value: first, pair: index }, { value: second, pair: index }]).sort(() => Math.random() - .5);
    $('#memory-pairs').textContent = `0/${pairs.length}`; $('#memory-moves').textContent = '0'; $('#memory-score').textContent = '0'; $('#memory-result').textContent = '';
    updateMemoryTime();
    board.innerHTML = cards.map((card, index) => `<button class="memory-tile" type="button" data-index="${index}" disabled><span class="memory-front">?</span><span class="memory-back">${card.value}</span></button>`).join('');
    if (gameReady) board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = false; });
    board.querySelectorAll('.memory-tile').forEach((tile) => tile.addEventListener('click', () => {
    if (!gameReady || gamePaused || locked || tile.classList.contains('flipped') || tile.classList.contains('matched')) return;
    startMemoryTimer();
    tile.classList.add('flipped');
    if (!firstCard) { firstCard = tile; return; }
    moves += 1; $('#memory-moves').textContent = moves; locked = true;
    const secondCard = tile; const first = cards[Number(firstCard.dataset.index)]; const second = cards[Number(secondCard.dataset.index)];
    if (first.pair === second.pair) { firstCard.classList.add('matched'); secondCard.classList.add('matched'); matched += 1; score += Math.max(40, 140 - moves * 5); $('#memory-score').textContent = score; $('#memory-pairs').textContent = `${matched}/${pairs.length}`; $('#memory-feedback').textContent = 'Par encontrado! Muito bem!'; $('#memory-feedback').className = 'memory-feedback success'; setMotivation(matched === pairs.length - 1 ? 'Está quase! O último par está esperando por você!' : 'Muito bem! Sua memória está ficando mais forte.'); playTone(740); locked = false; firstCard = null; if (matched === pairs.length) { stopMemoryTimer(); recordMemoryRanking(); setMotivation('Você venceu! Que concentração incrível!'); if (score > Number(localStorage.getItem(bestKey) || 0)) localStorage.setItem(bestKey, String(score)); $('#memory-result').innerHTML = `<img src="assets/trophy.svg" alt="Troféu"><strong>Parabéns, ${nickname}!</strong> Você venceu com ${score} pontos em ${moves} jogadas.`; } }
    else { $('#memory-feedback').textContent = 'Não combinou. Tente novamente!'; $('#memory-feedback').className = 'memory-feedback error'; setMotivation('Sem problema! Errar faz parte de aprender.'); playTone(180); setTimeout(() => { firstCard.classList.remove('flipped'); secondCard.classList.remove('flipped'); locked = false; firstCard = null; }, 800); }
    }));
  };
  $$('.memory-level').forEach((button) => button.addEventListener('click', () => { $$('.memory-level').forEach((item) => item.classList.remove('active')); button.classList.add('active'); memoryLevel = button.dataset.memoryLevel; setupBoard(); $('#memory-feedback').textContent = `Nível ${button.textContent.trim()} selecionado. Boa sorte!`; }));
  setupBoard();
  $('#memory-play').addEventListener('click', () => { gameReady = true; gamePaused = false; board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = false; }); $('#memory-play').textContent = '▶ Em jogo'; $('#memory-play').disabled = true; $('#memory-pause').disabled = false; $('#memory-feedback').textContent = 'Escolha uma carta para começar.'; setMotivation('Você consegue! Observe bem as cartas.'); startMemoryTimer(); board.querySelector('.memory-tile').focus(); });
  $('#memory-pause').addEventListener('click', () => { if (!gameReady) return; gamePaused = !gamePaused; if (gamePaused) { stopMemoryTimer(); $('#memory-pause').textContent = '▶ Continuar'; $('#memory-feedback').textContent = 'Partida pausada. Continue quando estiver pronto.'; setMotivation('Pausa tranquila. Você pode continuar quando quiser.'); } else { startMemoryTimer(); $('#memory-pause').textContent = 'Ⅱ Pausar'; $('#memory-feedback').textContent = 'Sua vez. Encontre os pares!'; } });
  $('#memory-restart').addEventListener('click', () => { gameReady = true; setupBoard(); board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = false; }); $('#memory-play').textContent = '▶ Em jogo'; $('#memory-play').disabled = true; $('#memory-pause').disabled = false; $('#memory-feedback').textContent = 'Novo jogo iniciado. Encontre os pares!'; $('#memory-feedback').className = 'memory-feedback'; });
  $('#memory-play-again').addEventListener('click', () => $('#memory-restart').click());
  $('#memory-menu').addEventListener('click', () => { stopMemoryTimer(); overlay.remove(); document.body.classList.remove('memory-active'); createGameLibrary(nickname); });
  $('#memory-support').addEventListener('click', () => { supportMode = !supportMode; overlay.classList.toggle('memory-support-mode', supportMode); $('#memory-support').setAttribute('aria-pressed', String(supportMode)); $('#memory-support').textContent = supportMode ? '♥ Apoio ativado' : '♥ Modo de apoio'; setupBoard(); $('#memory-feedback').textContent = supportMode ? 'Modo de apoio ativado: você ganhou 30 segundos extras.' : 'Modo de apoio desativado.'; });
  $('#memory-dark').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  $('#memory-account').addEventListener('click', () => { stopMemoryTimer(); overlay.remove(); document.body.classList.remove('memory-active'); createAuthScreen(); });
  $('#memory-exit').addEventListener('click', () => { stopMemoryTimer(); overlay.remove(); document.body.classList.remove('memory-active'); createGameLibrary(nickname); });
}

function createHeroBrand() {
  if ($('.hero-brand')) return;
  const title = $('#page-title');
  const brand = document.createElement('p');
  brand.className = 'hero-brand';
  brand.textContent = 'GUILF TECH';
  title.parentNode.insertBefore(brand, title);
}

function createAuthScreen() {
  const existingAuth = $('.auth-screen');
  if (existingAuth) existingAuth.remove();
  const auth = document.createElement('section');
  auth.className = 'auth-screen';
  auth.innerHTML = '<div class="auth-card"><img class="auth-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><p class="eyebrow">ARENA MATEMÁTICA</p><h1 id="auth-title">Bem-vindo!</h1><p class="auth-subtitle">Entre para continuar sua jornada.</p><div class="auth-tabs"><button type="button" class="auth-tab active" data-auth-mode="login">Entrar</button><button type="button" class="auth-tab" data-auth-mode="register">Criar cadastro</button></div><form id="auth-form"><label for="auth-name" class="register-only">Seu nick</label><input id="auth-name" class="register-only" type="text" maxlength="18" placeholder="Como quer ser chamado?" autocomplete="nickname"><label for="auth-email">E-mail</label><input id="auth-email" type="email" placeholder="seu@email.com" autocomplete="email" required><label for="auth-password">Senha</label><input id="auth-password" type="password" minlength="4" placeholder="Mínimo de 4 caracteres" autocomplete="current-password" required><button class="auth-submit" type="submit">Entrar na arena <span>→</span></button><p id="auth-message" class="auth-message" role="alert"></p></form><small class="auth-note">Cadastro salvo somente neste navegador.</small></div>';
  document.body.prepend(auth);
  if (!$('#account-button')) {
    const accountButton = document.createElement('button');
    accountButton.id = 'account-button';
    accountButton.className = 'account-button';
    accountButton.type = 'button';
    accountButton.textContent = 'Trocar conta';
    accountButton.addEventListener('click', () => {
      state.active = false;
      clearTimeout(state.machineTimer);
      clearInterval(state.questionTimer);
      setInteractive(false);
      createAuthScreen();
    });
    $('.top-actions').prepend(accountButton);
  }
  let mode = 'login';
  const name = $('#auth-name');
  const email = $('#auth-email');
  const password = $('#auth-password');
  const message = $('#auth-message');
  const setMode = (nextMode) => {
    mode = nextMode;
    const register = mode === 'register';
    auth.classList.toggle('auth-register', register);
    $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
    $$('.register-only').forEach((field) => field.classList.toggle('visible', register));
    name.required = register;
    $('#auth-title').textContent = register ? 'Crie sua conta' : 'Bem-vindo!';
    $('.auth-subtitle').textContent = register ? 'Prepare seu perfil para a próxima batalha.' : 'Entre para continuar sua jornada.';
    $('.auth-submit').innerHTML = register ? 'Criar conta <span>→</span>' : 'Entrar na arena <span>→</span>';
    message.textContent = '';
  };
  $$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.authMode)));
  $('#auth-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const users = JSON.parse(localStorage.getItem('contaCombateUsers') || '[]');
    const normalizedEmail = email.value.trim().toLowerCase();
    const user = users.find((item) => item.email === normalizedEmail);
    if (mode === 'register') {
      if (user) { message.textContent = 'Este e-mail já possui cadastro.'; return; }
      users.push({ name: name.value.trim() || 'Jogador 1', email: normalizedEmail, password: password.value });
      localStorage.setItem('contaCombateUsers', JSON.stringify(users));
      message.textContent = 'Cadastro criado! Agora entre na arena.';
      setMode('login'); email.value = normalizedEmail; password.value = ''; return;
    }
    if (!user || user.password !== password.value) { message.textContent = 'E-mail ou senha incorretos.'; return; }
    $('#nickname-input').value = user.name;
    auth.classList.add('authenticated');
    setTimeout(() => { auth.remove(); createHomeScreen(user.name); }, 350);
  });
}
function createAccessibilityButton() {
  if ($('#accessibility-button')) return;
  const button = document.createElement('button');
  button.id = 'accessibility-button';
  button.className = 'icon-button accessibility-button';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Ativar modo acessível');
  button.title = 'Modo acessível';
  button.textContent = 'Aa';
  button.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('accessibility-mode');
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Desativar modo acessível' : 'Ativar modo acessível');
    toast(enabled ? 'Modo acessível ativado.' : 'Modo acessível desativado.');
    speak(enabled ? 'Modo acessível ativado.' : 'Modo acessível desativado.');
  });
  $('.top-actions').prepend(button);
}

function newQuestion() {
  let display; let answer; let speech;
  if (state.difficulty === 'easy') {
    const first = Math.floor(Math.random() * 9) + 2;
    const second = Math.floor(Math.random() * 9) + 2;
    answer = first * second; display = `${first} × ${second} = ?`; speech = `Quanto é ${first} vezes ${second}?`;
  } else if (state.difficulty === 'medium') {
    const powerMode = Math.random() < 0.5;
    if (powerMode) {
      const base = Math.floor(Math.random() * 8) + 2;
      answer = base * base; display = `${base}² = ?`; speech = `Quanto é ${base} elevado ao quadrado?`;
    } else {
      const root = Math.floor(Math.random() * 9) + 2;
      answer = root; display = `√${root * root} = ?`; speech = `Qual é a raiz quadrada de ${root * root}?`;
    }
  } else {
    const coefficient = Math.floor(Math.random() * 5) + 2;
    answer = Math.floor(Math.random() * 9) + 1;
    const constant = Math.floor(Math.random() * 10) + 1;
    const result = coefficient * answer + constant;
    display = `${coefficient}x + ${constant} = ${result}`;
    speech = `Qual é o valor de x? ${coefficient} vezes x mais ${constant} é igual a ${result}.`;
  }
  state.question = { answer, speech };
  $('#equation').textContent = display;
  $('#equation').setAttribute('aria-label', speech);
  $('#question-number').textContent = String(state.questionIndex + 1).padStart(2, '0');
  const choices = new Set([answer]);
  while (choices.size < 4) choices.add(Math.max(0, answer + Math.floor(Math.random() * 9) - 4));
  $('#choice-grid').innerHTML = [...choices].sort(() => Math.random() - .5).map((choice) => `<button class="choice-button" type="button" data-answer="${choice}">${choice}</button>`).join('');
  $$('#choice-grid button').forEach((button) => button.addEventListener('click', () => submitAnswer(Number(button.dataset.answer))));
  if (state.sound) speakQuestion();
  startQuestionTimer();
}

function speak(text) { if (state.sound && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
function playTone(frequency, duration = 0.12) { if (!state.sound || !window.AudioContext) return; const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; oscillator.connect(gain); gain.connect(context.destination); gain.gain.value = 0.04; oscillator.start(); oscillator.stop(context.currentTime + duration); }
function speakQuestion() { const q = state.question; if (!q) { speak('Clique em Começar batalha para receber uma conta.'); return; } speak(`Desafio ${state.questionIndex + 1}. ${q.speech}`); }
function updateHealth() {
  $('#player-health-bar').style.width = `${state.playerHealth}%`;
  $('#opponent-health-bar').style.width = `${state.opponentHealth}%`;
  $('#player-health-text').textContent = `${state.playerHealth} / 100`;
  $('#opponent-health-text').textContent = `${state.opponentHealth} / ${state.maxOpponentHealth}`;
  $('#streak-value').textContent = state.streak;
  $('#score-value').textContent = state.score;
  $('#question-timer').textContent = `${state.questionSeconds}s`;
  $('.streak-badge').setAttribute('aria-label', `Sequência atual de ${state.streak} acertos`);
}
function setInteractive(enabled) { $('#answer-input').disabled = !enabled; $('#attack-button').disabled = !enabled; }
function showFeedback(message, type) { const feedback = $('#answer-feedback'); feedback.textContent = message; feedback.className = `feedback ${type}`; }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2200); }
function animate(selector, className) { const element = $(selector); element.classList.remove(className); void element.offsetWidth; element.classList.add(className); setTimeout(() => element.classList.remove(className), 650); }
function setCharacter(character) {
  const images = { raio: ['character-raio.svg', 'Herói Raio'], foguete: ['character-foguete.svg', 'Herói Foguete'], mente: ['character-mente.svg', 'Herói Mente'], guardiao: ['hero-guardiao.svg', 'Herói Guardião'], maga: ['hero-maga.svg', 'Heroína Maga'], ninja: ['hero-ninja.svg', 'Herói Ninja'] };
  const selected = images[character] || images.raio;
  state.character = character;
  $('.character-player').innerHTML = `<img src="assets/${selected[0]}" alt="${selected[1]}">`;
}
function addMathImages() {
  const images = { easy: ['math-addition.svg', 'Adição'], medium: ['math-subtraction.svg', 'Subtração'], hard: ['math-multiplication.svg', 'Multiplicação'] };
  $$('.mode-card').forEach((card) => {
    const image = images[card.dataset.difficulty];
    if (image) card.querySelector('.mode-icon').innerHTML = `<img src="assets/${image[0]}" alt="${image[1]}">`;
  });
}
function addInterfaceImages() {
  const intro = $('.intro');
  if (intro && !$('.math-book-art')) intro.insertAdjacentHTML('beforeend', '<img class="math-book-art" src="assets/math-book.svg" alt="Livro de matemática">');
  const stats = $('.game-stats');
  if (stats && !$('.points-art')) stats.insertAdjacentHTML('afterbegin', '<img class="points-art" src="assets/point-coin.svg" alt="">');
}
function machineAttack() {
  if (state.training) return 0;
  const machineDamage = { easy: 5, medium: 10, hard: 15 }[state.difficulty];
  if (state.shield) { state.shield = false; showFeedback('Seu escudo bloqueou o ataque da máquina!', 'success'); toast('Escudo protegido!'); return 0; }
  state.playerHealth = Math.max(0, state.playerHealth - machineDamage);
  animate('.player-card', 'hit-by-machine');
  toast(`O Professor Robô atacou! -${machineDamage} energia`);
  return machineDamage;
}
function startQuestionTimer() {
  clearInterval(state.questionTimer);
  if (state.training) { state.questionSeconds = 0; updateHealth(); return; }
  state.questionSeconds = { easy: 30, medium: 45, hard: 60 }[state.difficulty];
  state.questionTimer = setInterval(() => {
    state.questionSeconds -= 1;
    updateHealth();
    if (state.questionSeconds <= 0) { clearInterval(state.questionTimer); showFeedback('Tempo esgotado!', 'error'); submitAnswer(null); }
  }, 1000);
}
function scheduleMachineAttack() {
  if (state.training) return;
  clearTimeout(state.machineTimer);
  const machineTime = { easy: 12000, medium: 8000, hard: 5000 }[state.difficulty];
  state.machineTimer = setTimeout(() => {
    if (!state.active || !state.question) return;
    const machineDamage = machineAttack();
    showFeedback(`A máquina atacou sozinha! -${machineDamage} energia.`, 'error');
    updateHealth();
    if (state.playerHealth === 0) endGame();
    else scheduleMachineAttack();
  }, machineTime);
}
function createNicknameField() {
  const section = document.createElement('section');
  section.className = 'nickname-section';
  section.innerHTML = '<div class="nickname-row"><label for="nickname-input">Seu nick</label><input id="nickname-input" type="text" maxlength="18" autocomplete="nickname" placeholder="Digite seu nick" value="Jogador 1"></div><div class="game-stats"><span>Pontos <strong id="score-value">0</strong></span><span>Recorde <strong id="best-score">0</strong></span><span>Tempo <strong id="question-timer">0s</strong></span><span>Partidas <strong id="match-count">0</strong></span></div><div class="character-select"><span>Escolha seu herói</span><button type="button" data-character="raio">Raio</button><button type="button" data-character="foguete">Foguete</button><button type="button" data-character="mente">Mente</button><button type="button" data-character="guardiao">Guardião</button><button type="button" data-character="maga">Maga</button><button type="button" data-character="ninja">Ninja</button></div><div class="item-actions"><button type="button" id="shield-button" title="Bloqueia o próximo ataque"><img src="assets/shield.svg" alt="">Usar escudo</button><button type="button" id="heal-button" title="Recupera 20 de energia"><img src="assets/heal.svg" alt="">Recuperar energia</button><button type="button" id="power-button" title="Causa 30 de dano"><img src="assets/power.svg" alt="">Ataque especial</button><button type="button" id="pause-button" title="Pausa a partida"><img src="assets/pause.svg" alt="">Pausar partida</button><button type="button" id="training-button" title="Pratique sem ataques da máquina"><img src="assets/training.svg" alt="">Praticar</button><button type="button" id="restart-button" title="Começa uma nova partida"><img src="assets/restart.svg" alt="">Começar novamente</button></div><div id="final-report" class="final-report" aria-live="polite"></div>';
  $('.arena').before(section);
  const heroImages = { raio: 'character-raio.svg', foguete: 'character-foguete.svg', mente: 'character-mente.svg', guardiao: 'hero-guardiao.svg', maga: 'hero-maga.svg', ninja: 'hero-ninja.svg' };
  $$('.character-select button').forEach((button) => { const label = button.textContent; button.innerHTML = `<img src="assets/${heroImages[button.dataset.character]}" alt="">${label}`; });
  $('#shield-button').addEventListener('click', () => { if (!state.active || state.shield) return; state.shield = true; toast('Escudo ativado!'); });
  $('#heal-button').addEventListener('click', () => { if (!state.active || state.playerHealth >= config.startingHealth) return; state.playerHealth = Math.min(config.startingHealth, state.playerHealth + 20); updateHealth(); toast('Você recuperou 20 de energia!'); });
  $('#power-button').addEventListener('click', () => { if (!state.active || state.score < 200 || !state.opponentHealth) return; state.score -= 200; state.opponentHealth = Math.max(0, state.opponentHealth - 30); updateHealth(); animate('.opponent-card', 'hit-by-player'); toast('Ataque forte! -30 energia'); if (!state.opponentHealth) endGame(); });
  $$('.character-select button').forEach((button) => button.addEventListener('click', () => { setCharacter(button.dataset.character); toast(`Personagem ${button.textContent} escolhido!`); }));
  $('#pause-button').addEventListener('click', togglePause);
  $('#training-button').addEventListener('click', () => { state.training = !state.training; $('#training-button').textContent = state.training ? 'Sair do treino' : 'Modo treino'; toast(state.training ? 'Modo treino ativado: a máquina não ataca.' : 'Batalha normal ativada.'); if (state.active) { clearTimeout(state.machineTimer); startQuestionTimer(); scheduleMachineAttack(); } });
  $('#restart-button').addEventListener('click', startGame);
  const history = JSON.parse(localStorage.getItem('contaCombateHistory') || '[]');
  $('#match-count').textContent = history.length;
  $('#best-score').textContent = Math.max(0, ...history.map((match) => match.score || 0));
}
function saveMatch(won) {
  const history = JSON.parse(localStorage.getItem('contaCombateHistory') || '[]');
  history.push({ won, score: state.score, difficulty: state.difficulty, correct: state.correctAnswers, date: new Date().toLocaleDateString('pt-BR') });
  localStorage.setItem('contaCombateHistory', JSON.stringify(history.slice(-20)));
  $('#match-count').textContent = Math.min(history.length, 20);
  $('#best-score').textContent = Math.max(0, ...history.map((match) => match.score || 0));
}

function submitAnswer(value) {
  if (!state.active || !state.question) return;
  clearInterval(state.questionTimer);
  clearTimeout(state.machineTimer);
  const correct = value === state.question.answer;
  if (correct) {
    state.streak += 1;
    state.correctAnswers += 1;
    const damage = 15 + Math.min(state.streak * 2, 10);
    state.score += 100 + state.streak * 10;
    state.opponentHealth = Math.max(0, state.opponentHealth - damage);
    showFeedback(`Acertou! Você causou ${damage} de dano.`, 'success');
    animate('.opponent-card', 'hit-by-player');
    animate('#answer-feedback', 'feedback-pop');
    toast(`Ataque certeiro! -${damage} energia`);
    speak(`Muito bem! Você acertou e causou ${damage} de dano.`);
    playTone(740);
  } else {
    state.streak = 0;
    const machineDamage = machineAttack();
    showFeedback(`Quase! A resposta era ${state.question.answer}.`, 'error');
    animate('#answer-feedback', 'feedback-shake');
    speak(`A resposta correta era ${state.question.answer}.`);
    showFeedback(`A máquina contra-atacou! -${machineDamage} energia. A resposta era ${state.question.answer}.`, 'error');
    playTone(180);
  }
  updateHealth();
  state.questionIndex += 1;
  setInteractive(false);
  if (state.opponentHealth === 0 || state.playerHealth === 0 || state.questionIndex >= config.rounds) {
    endGame();
  } else {
    setTimeout(() => { showFeedback('', ''); newQuestion(); scheduleMachineAttack(); setInteractive(true); $('#answer-input').focus(); }, 1100);
  }
}
function endGame() {
  state.active = false; clearTimeout(state.machineTimer); clearInterval(state.questionTimer); setInteractive(false);
  const won = state.opponentHealth === 0 || (state.playerHealth > state.opponentHealth && state.questionIndex >= config.rounds);
  $('.arena').classList.toggle('game-won', won);
  $('.arena').classList.toggle('game-lost', !won);
  const nickname = $('#player-name').textContent;
  $('#turn-label').textContent = won ? `Parabéns, ${nickname}! Você venceu a batalha!` : 'Fim de jogo. Toda tentativa ensina algo novo.';
  if (won) {
    state.score += 500;
    showFeedback(`Parabéns, ${nickname}! Você derrotou o Professor Robô!`, 'success');
    toast(`Parabéns, ${nickname}! Você venceu!`);
  }
  saveMatch(won);
  saveRanking(nickname, (Date.now() - state.gameStartedAt) / 1000, 'battle');
  renderRanking($('.main-ranking'), 'battle');
  showFinalReport(won);
  $('#start-button').textContent = 'Jogar novamente →';
  speak(won ? 'Parabéns! Você venceu a batalha.' : 'Fim de jogo. Tente novamente.');
}
function showFinalReport(won) {
  const report = $('#final-report');
  const accuracy = state.questionIndex ? Math.round((state.correctAnswers / state.questionIndex) * 100) : 0;
  const medal = won && accuracy >= 90 ? 'Ouro' : won && accuracy >= 70 ? 'Prata' : won ? 'Bronze' : 'Treino';
  report.innerHTML = `${won ? '<img src="assets/trophy.svg" alt="Troféu de vitória"><img class="victory-stars" src="assets/victory-stars.svg" alt="Estrelas de vitória">' : ''}<strong>${won ? 'Relatório da vitória' : 'Relatório da partida'}</strong><span>Acertos: ${state.correctAnswers}/${state.questionIndex}</span><span>Precisão: ${accuracy}%</span><span>Pontuação: ${state.score}</span><span>Medalha: ${medal}</span>`;
}
function startGame() {
  state.active = true; state.paused = false; state.gameStartedAt = Date.now(); state.questionIndex = 0; state.streak = 0; state.score = 0; state.correctAnswers = 0; state.shield = false; state.playerHealth = config.startingHealth; state.maxOpponentHealth = state.difficulty === 'hard' ? 130 : config.startingHealth; state.opponentHealth = state.maxOpponentHealth;
  const nickname = $('#nickname-input').value.trim() || 'Jogador 1';
  $('#player-name').textContent = nickname;
  $('#start-button').textContent = 'Batalha em andamento'; $('#turn-label').textContent = 'Sua vez de atacar!';
  $('#opponent-name').textContent = state.difficulty === 'hard' ? `${config.soloOpponent} - Chefe` : config.soloOpponent;
  $('#opponent-label').textContent = 'MÁQUINA';
  newQuestion(); scheduleMachineAttack(); updateHealth(); setInteractive(true); $('#answer-input').focus();
}
function createMainGameActions() {
  const arena = $('.arena');
  if (!arena || $('.main-game-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'main-game-actions';
  actions.innerHTML = '<button type="button" class="main-play-again">↻ Jogar de novo</button><button type="button" class="main-library-link">▣ Voltar à biblioteca</button>';
  arena.appendChild(actions);
  const ranking = document.createElement('section');
  ranking.className = 'main-ranking ranking-panel';
  arena.appendChild(ranking);
  renderRanking(ranking, 'battle');
  actions.querySelector('.main-play-again').addEventListener('click', startGame);
  actions.querySelector('.main-library-link').addEventListener('click', () => { if (state.active) { state.active = false; clearTimeout(state.machineTimer); clearInterval(state.questionTimer); setInteractive(false); } createGameLibrary($('#player-name').textContent || 'Jogador 1'); });
}
function togglePause() {
  if (!state.active) return;
  state.paused = !state.paused;
  if (state.paused) { clearInterval(state.questionTimer); clearTimeout(state.machineTimer); setInteractive(false); $('#pause-button').textContent = 'Continuar'; $('#turn-label').textContent = 'Jogo pausado'; }
  else { $('#pause-button').textContent = 'Pausar'; $('#turn-label').textContent = 'Sua vez de atacar!'; setInteractive(true); startQuestionTimer(); scheduleMachineAttack(); }
}

$$('.mode-card').forEach((card) => card.addEventListener('click', () => { $$('.mode-card').forEach((item) => item.classList.remove('selected')); card.classList.add('selected'); state.difficulty = card.dataset.difficulty; $('#opponent-name').textContent = config.soloOpponent; $('#opponent-label').textContent = 'MÁQUINA'; $('#turn-label').textContent = 'Sua vez de atacar!'; }));
$('#start-button').addEventListener('click', startGame);
$('#answer-form').addEventListener('submit', (event) => { event.preventDefault(); submitAnswer(Number($('#answer-input').value)); $('#answer-input').value = ''; });
$('#read-question').addEventListener('click', speakQuestion);
$('#dark-mode-button').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
$('#fullscreen-button').addEventListener('click', (event) => toggleFullscreen(event.currentTarget));
createNicknameField();
addInterfaceImages();
createHeroBrand();
createMainGameActions();
setCharacter(state.character);
$('.character-robot').innerHTML = '<img src="assets/character-robo.svg" alt="Professor Robô">';
createAuthScreen();
updateHealth();
