const config = window.gameConfig || { rounds: 10, startingHealth: 100, defaultMode: 'solo', soloOpponent: 'Professor Robô' };
const state = { difficulty: 'easy', active: false, training: false, paused: false, question: null, questionIndex: 0, streak: 0, score: 0, correctAnswers: 0, playerHealth: config.startingHealth, opponentHealth: config.startingHealth, maxOpponentHealth: config.startingHealth, machineTimer: null, questionTimer: null, questionSeconds: 0, shield: false, character: 'raio', sound: true, fontLarge: false };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
  auth.innerHTML = '<div class="auth-card"><img class="auth-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><p class="eyebrow">ARENA MATEMÁTICA</p><h1 id="auth-title">Bem-vindo de volta!</h1><p class="auth-subtitle">Entre para continuar sua jornada.</p><div class="auth-tabs"><button type="button" class="auth-tab active" data-auth-mode="login">Entrar</button><button type="button" class="auth-tab" data-auth-mode="register">Criar cadastro</button></div><form id="auth-form"><label for="auth-name" class="register-only">Seu nick</label><input id="auth-name" class="register-only" type="text" maxlength="18" placeholder="Como quer ser chamado?" autocomplete="nickname"><label for="auth-email">E-mail</label><input id="auth-email" type="email" placeholder="seu@email.com" autocomplete="email" required><label for="auth-password">Senha</label><input id="auth-password" type="password" minlength="4" placeholder="Mínimo de 4 caracteres" autocomplete="current-password" required><button class="auth-submit" type="submit">Entrar na arena <span>→</span></button><p id="auth-message" class="auth-message" role="alert"></p></form><small class="auth-note">Cadastro salvo somente neste navegador.</small></div>';
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
    $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
    $$('.register-only').forEach((field) => field.classList.toggle('visible', register));
    name.required = register;
    $('#auth-title').textContent = register ? 'Crie sua conta' : 'Bem-vindo de volta!';
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
    setTimeout(() => auth.remove(), 350);
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
  const difficulty = { easy: { max: 10, subtractionChance: 0.2 }, medium: { max: 20, subtractionChance: 0.4 }, hard: { max: 50, subtractionChance: 0.5 } }[state.difficulty];
  const addition = state.difficulty === 'easy';
  const multiplication = state.difficulty === 'hard';
  const division = false;
  let first = Math.floor(Math.random() * difficulty.max) + 1;
  let second = Math.floor(Math.random() * difficulty.max) + 1;
  if (multiplication) { first = Math.floor(Math.random() * (state.difficulty === 'hard' ? 12 : 10)) + 1; second = Math.floor(Math.random() * 10) + 1; }
  if (division) { second = Math.floor(Math.random() * 9) + 2; const quotient = Math.floor(Math.random() * 10) + 1; first = second * quotient; }
  if (!addition && !multiplication && !division && second > first) [first, second] = [second, first];
  const answer = multiplication ? first * second : division ? first / second : addition ? first + second : first - second;
  const symbol = multiplication ? '×' : division ? '÷' : addition ? '+' : '-';
  state.question = { first, second, answer, symbol };
  $('#equation').textContent = `${first} ${symbol} ${second} = ?`;
  const operationName = multiplication ? 'vezes' : division ? 'dividido por' : addition ? 'mais' : 'menos';
  $('#equation').setAttribute('aria-label', `Quanto é ${first} ${operationName} ${second}?`);
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
function speakQuestion() { const q = state.question; if (!q) { speak('Clique em Começar batalha para receber uma conta.'); return; } const names = { '+': 'mais', '-': 'menos', '×': 'vezes', '÷': 'dividido por' }; speak(`Desafio ${state.questionIndex + 1}. Quanto é ${q.first} ${names[q.symbol]} ${q.second}?`); }
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
  state.questionSeconds = { easy: 15, medium: 10, hard: 7 }[state.difficulty];
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
  showFinalReport(won);
  $('#start-button').textContent = 'Jogar novamente →';
  speak(won ? 'Parabéns! Você venceu a batalha.' : 'Fim de jogo. Tente novamente.');
}
function showFinalReport(won) {
  const report = $('#final-report');
  const accuracy = state.questionIndex ? Math.round((state.correctAnswers / state.questionIndex) * 100) : 0;
  const medal = won && accuracy >= 90 ? 'Ouro' : won && accuracy >= 70 ? 'Prata' : won ? 'Bronze' : 'Treino';
  report.innerHTML = `${won ? '<img src="assets/trophy.svg" alt="Troféu de vitória">' : ''}<strong>${won ? 'Relatório da vitória' : 'Relatório da partida'}</strong><span>Acertos: ${state.correctAnswers}/${state.questionIndex}</span><span>Precisão: ${accuracy}%</span><span>Pontuação: ${state.score}</span><span>Medalha: ${medal}</span>`;
}
function startGame() {
  state.active = true; state.paused = false; state.questionIndex = 0; state.streak = 0; state.score = 0; state.correctAnswers = 0; state.shield = false; state.playerHealth = config.startingHealth; state.maxOpponentHealth = state.difficulty === 'hard' ? 130 : config.startingHealth; state.opponentHealth = state.maxOpponentHealth;
  const nickname = $('#nickname-input').value.trim() || 'Jogador 1';
  $('#player-name').textContent = nickname;
  $('#start-button').textContent = 'Batalha em andamento'; $('#turn-label').textContent = 'Sua vez de atacar!';
  $('#opponent-name').textContent = state.difficulty === 'hard' ? `${config.soloOpponent} - Chefe` : config.soloOpponent;
  $('#opponent-label').textContent = 'MÁQUINA';
  newQuestion(); scheduleMachineAttack(); updateHealth(); setInteractive(true); $('#answer-input').focus();
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
$('#dark-mode-button').addEventListener('click', () => { const dark = document.body.classList.toggle('dark-mode'); $('#dark-mode-button').setAttribute('aria-pressed', String(dark)); $('#dark-mode-button').setAttribute('aria-label', dark ? 'Desativar modo escuro' : 'Ativar modo escuro'); $('#dark-mode-button').textContent = dark ? '☀' : '☾'; });
createNicknameField();
addMathImages();
createHeroBrand();
setCharacter(state.character);
$('.character-robot').innerHTML = '<img src="assets/character-robo.svg" alt="Professor Robô">';
createAuthScreen();
updateHealth();
