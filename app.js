const config = window.gameConfig || { rounds: 10, startingHealth: 100, defaultMode: 'solo', soloOpponent: 'Professor Robô' };
const state = { mode: config.defaultMode, active: false, question: null, questionIndex: 0, streak: 0, playerHealth: config.startingHealth, opponentHealth: config.startingHealth, playerTurn: 1, sound: true, fontLarge: false };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function newQuestion() {
  const addition = Math.random() > 0.35;
  let first = Math.floor(Math.random() * 11) + 1;
  let second = Math.floor(Math.random() * 10) + 1;
  if (!addition && second > first) [first, second] = [second, first];
  const answer = addition ? first + second : first - second;
  const symbol = addition ? '+' : '-';
  state.question = { first, second, answer, symbol };
  $('#equation').textContent = `${first} ${symbol} ${second} = ?`;
  $('#equation').setAttribute('aria-label', `Quanto é ${first} ${addition ? 'mais' : 'menos'} ${second}?`);
  $('#question-number').textContent = String(state.questionIndex + 1).padStart(2, '0');
  const choices = new Set([answer]);
  while (choices.size < 4) choices.add(Math.max(0, answer + Math.floor(Math.random() * 9) - 4));
  $('#choice-grid').innerHTML = [...choices].sort(() => Math.random() - .5).map((choice) => `<button class="choice-button" type="button" data-answer="${choice}">${choice}</button>`).join('');
  $$('#choice-grid button').forEach((button) => button.addEventListener('click', () => submitAnswer(Number(button.dataset.answer))));
  if (state.sound) speakQuestion();
}

function speak(text) { if (state.sound && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
function speakQuestion() { const q = state.question; if (!q) { speak('Clique em Começar batalha para receber uma conta.'); return; } speak(`Desafio ${state.questionIndex + 1}. Quanto é ${q.first} ${q.symbol === '+' ? 'mais' : 'menos'} ${q.second}?`); }
function updateHealth() {
  $('#player-health-bar').style.width = `${state.playerHealth}%`;
  $('#opponent-health-bar').style.width = `${state.opponentHealth}%`;
  $('#player-health-text').textContent = `${state.playerHealth} / 100`;
  $('#opponent-health-text').textContent = `${state.opponentHealth} / 100`;
  $('#streak-value').textContent = state.streak;
  $('.streak-badge').setAttribute('aria-label', `Sequência atual de ${state.streak} acertos`);
}
function setInteractive(enabled) { $('#answer-input').disabled = !enabled; $('#attack-button').disabled = !enabled; }
function showFeedback(message, type) { const feedback = $('#answer-feedback'); feedback.textContent = message; feedback.className = `feedback ${type}`; }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2200); }

function submitAnswer(value) {
  if (!state.active || !state.question) return;
  const correct = value === state.question.answer;
  if (correct) {
    state.streak += 1;
    const damage = 15 + Math.min(state.streak * 2, 10);
    state.opponentHealth = Math.max(0, state.opponentHealth - damage);
    showFeedback(`Acertou! Você causou ${damage} de dano.`, 'success');
    toast(`Ataque certeiro! -${damage} energia`);
    speak(`Muito bem! Você acertou e causou ${damage} de dano.`);
  } else {
    state.streak = 0;
    state.playerHealth = Math.max(0, state.playerHealth - 10);
    showFeedback(`Quase! A resposta era ${state.question.answer}.`, 'error');
    speak(`A resposta correta era ${state.question.answer}.`);
    if (state.mode === 'duo') {
      state.playerTurn = state.playerTurn === 1 ? 2 : 1;
      $('#turn-label').textContent = `Agora é a vez do Jogador ${state.playerTurn}.`;
    } else toast('O Professor Robô contra-atacou! -10 energia');
  }
  updateHealth();
  state.questionIndex += 1;
  setInteractive(false);
  if (state.opponentHealth === 0 || state.playerHealth === 0 || state.questionIndex >= config.rounds) {
    endGame();
  } else {
    setTimeout(() => { showFeedback('', ''); newQuestion(); setInteractive(true); $('#answer-input').focus(); }, 1100);
  }
}
function endGame() {
  state.active = false; setInteractive(false);
  const won = state.opponentHealth === 0 || (state.playerHealth > state.opponentHealth && state.questionIndex >= config.rounds);
  $('#turn-label').textContent = won ? 'Vitória! Você dominou a arena.' : 'Fim de jogo. Toda tentativa ensina algo novo.';
  $('#start-button').textContent = 'Jogar novamente →';
  speak(won ? 'Parabéns! Você venceu a batalha.' : 'Fim de jogo. Tente novamente.');
}
function startGame() {
  state.active = true; state.questionIndex = 0; state.streak = 0; state.playerHealth = config.startingHealth; state.opponentHealth = config.startingHealth; state.playerTurn = 1;
  $('#start-button').textContent = 'Batalha em andamento'; $('#turn-label').textContent = state.mode === 'duo' ? 'Vez do Jogador 1 atacar!' : 'Sua vez de atacar!';
  $('#opponent-name').textContent = state.mode === 'solo' ? config.soloOpponent : 'Jogador 2';
  $('#opponent-label').textContent = state.mode === 'solo' ? 'OPONENTE' : 'JOGADOR 2';
  newQuestion(); updateHealth(); setInteractive(true); $('#answer-input').focus();
}

$$('.mode-card').forEach((card) => card.addEventListener('click', () => { $$('.mode-card').forEach((item) => item.classList.remove('selected')); card.classList.add('selected'); state.mode = card.dataset.mode; $('#opponent-name').textContent = state.mode === 'solo' ? config.soloOpponent : 'Jogador 2'; $('#opponent-label').textContent = state.mode === 'solo' ? 'OPONENTE' : 'JOGADOR 2'; $('#turn-label').textContent = state.mode === 'solo' ? 'Sua vez de atacar!' : 'Vez do Jogador 1 atacar!'; }));
$('#start-button').addEventListener('click', startGame);
$('#answer-form').addEventListener('submit', (event) => { event.preventDefault(); submitAnswer(Number($('#answer-input').value)); $('#answer-input').value = ''; });
$('#read-question').addEventListener('click', speakQuestion);
$('#sound-button').addEventListener('click', () => { state.sound = !state.sound; $('#sound-button').setAttribute('aria-pressed', String(state.sound)); $('#sound-button').setAttribute('aria-label', state.sound ? 'Desativar leitura automática' : 'Ativar leitura automática'); if (!state.sound) window.speechSynthesis?.cancel(); else speakQuestion(); });
$('#contrast-button').addEventListener('click', () => { document.body.classList.toggle('high-contrast'); const active = document.body.classList.contains('high-contrast'); $('#contrast-button').setAttribute('aria-pressed', String(active)); $('#contrast-button').setAttribute('aria-label', active ? 'Desativar alto contraste' : 'Ativar alto contraste'); });
$('#font-size-button').addEventListener('click', () => { state.fontLarge = !state.fontLarge; document.body.classList.toggle('large-text', state.fontLarge); $('#font-size-button').setAttribute('aria-pressed', String(state.fontLarge)); $('#font-size-button').setAttribute('aria-label', state.fontLarge ? 'Usar tamanho de texto normal' : 'Aumentar tamanho do texto'); });
updateHealth();
