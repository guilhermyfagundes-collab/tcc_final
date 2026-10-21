// Configuração global do jogo: número de rodadas, vida inicial do jogador e inimigo,
// modo padrão e nome do oponente principal.
const config = window.gameConfig || { rounds: 10, startingHealth: 100, defaultMode: 'solo', soloOpponent: 'Professor Robô' };

// Estado principal da aplicação: dificuldade atual, pontuação, vida, temporizador,
// perguntas carregadas e flags do jogo em andamento.
const state = { difficulty: 'easy', active: false, training: false, paused: false, answerLocked: false, question: null, questionIndex: 0, streak: 0, score: 0, correctAnswers: 0, playerHealth: config.startingHealth, opponentHealth: config.startingHealth, maxOpponentHealth: config.startingHealth, machineTimer: null, questionTimer: null, transitionTimer: null, memoryTimer: null, questionSeconds: 0, gameStartedAt: 0, sound: true, fontLarge: false, questionBank: [] };

// Chave usada para guardar o usuário autenticado no localStorage.
const SESSION_USER_KEY = 'contaCombateAuthUser';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Busca o usuário atual salvo no navegador para manter a sessão ativa.
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

// Função central de comunicação com a API do projeto.
// Recebe a ação, envia payload e retorna a resposta JSON da API.
async function apiRequest(action, payload = {}, method = 'POST') {
  const endpoint = 'api/index.php';
  const isGet = method === 'GET';
  const isDelete = method === 'DELETE';
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set('action', action);
  if (isGet) {
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
  }
  try {
    const response = await fetch(url, {
      method,
      headers: isGet || isDelete ? {} : { 'Content-Type': 'application/json' },
      body: isGet ? undefined : JSON.stringify({ action, ...payload })
    });
    return await response.json();
  } catch (error) {
    return null;
  }
}
// Recupera o ranking salvo localmente em storage para exibir resultados do usuário.
function rankingEntries() { return JSON.parse(localStorage.getItem('contaCombateRanking') || '[]'); }

// Carrega o ranking do servidor, salva no navegador e retorna os melhores tempos.
async function loadRankingFromServer(game, limit = 20) {
  const response = await apiRequest('ranking', { game, limit }, 'GET');
  if (!response || !response.success || !Array.isArray(response.items)) {
    return rankingEntries();
  }

  const items = response.items.map((entry) => ({
    name: entry.nickname || entry.name || 'Jogador 1',
    time: Number(entry.time || entry.time_seconds || 0),
    game: entry.game || game
  }));

  const otherGames = rankingEntries().filter((entry) => entry.game !== game);
  localStorage.setItem('contaCombateRanking', JSON.stringify([...otherGames, ...items].slice(0, limit * 4)));
  return items;
}
// Salva um novo resultado no ranking local e também envia para o backend quando tiver usuário logado.
function saveRanking(name, time, game) {
  const entries = rankingEntries();
  const safeEntry = { name: name || 'Jogador 1', time: Math.max(1, Math.round(time)), game };
  entries.push(safeEntry);
  entries.sort((first, second) => first.time - second.time);
  localStorage.setItem('contaCombateRanking', JSON.stringify(entries.slice(0, 20)));
  const user = getCurrentUser();
  if (user && user.id) {
    apiRequest('save_ranking', { user_id: user.id, name: safeEntry.name, time: safeEntry.time, game }, 'POST').then((response) => {
      if (response && response.success) {
        loadRankingFromServer(game, 20).then(() => {
          renderRanking($('.main-ranking'), battleRankingGame());
          renderRanking($('.memory-ranking'), 'memory');
          renderDifficultyRanking();
        });
      }
    });
  }
}

// Escapa caracteres HTML para evitar injeção de texto nas telas renderizadas dinamicamente.
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

// Renderiza a tabela de ranking para uma tela específica (batalha ou memória).
function renderRanking(element, game) {
  if (!element) return;
  const entries = rankingEntries().filter((entry) => entry.game === game).slice(0, 3);
  element.innerHTML = `<div class="ranking-heading"><span class="ranking-kicker">RANKING</span><strong>Melhores tempos</strong></div>${entries.length ? `<ol>${entries.map((entry, index) => `<li class="ranking-place place-${index + 1}"><span class="ranking-crown" aria-label="${index + 1}º lugar">♛</span><span class="ranking-name">${escapeHTML(entry.name)}</span><time>${entry.time}s</time></li>`).join('')}</ol>` : '<p class="ranking-empty">Complete uma partida para entrar no ranking.</p>'}`;
}
// Gera o identificador do ranking de acordo com a dificuldade selecionada.
function battleRankingGame() {
  return `battle-${state.difficulty}`;
}

// Cria blocos de ranking por dificuldade para visualizar os melhores tempos por modo.
function renderDifficultyRanking() {
  const existing = $('#difficulty-ranking');
  if (existing) existing.remove();
  const section = document.createElement('section');
  section.id = 'difficulty-ranking';
  section.className = 'difficulty-ranking-section';
  const labels = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
  const cards = Object.entries(labels).map(([difficulty, label]) => {
    const entries = rankingEntries().filter((entry) => entry.game === `battle-${difficulty}`).slice(0, 3);
    const rows = entries.length ? entries.map((entry, index) => `<li><span class="ranking-position">${index + 1}</span><strong>${escapeHTML(entry.name)}</strong><time>${entry.time}s</time></li>`).join('') : '<li class="ranking-empty">Ainda não há resultados.</li>';
    return `<article class="difficulty-ranking-card difficulty-${difficulty}"><div><span>RANKING</span><h2>${label}</h2></div><ol>${rows}</ol></article>`;
  }).join('');
  section.innerHTML = `<div class="difficulty-ranking-title"><div><span class="eyebrow">RANKING POR DIFICULDADES</span><h2>Melhores resultados</h2></div><p>Os tempos mais rápidos de cada modo.</p></div><div class="difficulty-ranking-grid">${cards}</div>`;
  $('.mode-section').insertAdjacentElement('afterend', section);
}
// Alterna entre tela cheia e modo normal para melhorar a imersão do jogo.
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
// Aplica o tema escuro/claro em toda a interface e salva a preferência do usuário.
function setTheme(dark) {
  document.body.classList.toggle('dark-mode', dark);
  localStorage.setItem('contaCombateTheme', dark ? 'dark' : 'light');
  const user = getCurrentUser();
  if (user && user.id) {
    apiRequest('settings', { user_id: user.id, theme: dark ? 'dark' : 'light' }, 'POST');
  }
  $$('#dark-mode-button, #library-dark-mode, #memory-dark, .home-theme').forEach((button) => {
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = dark ? 'Tema claro' : 'Tema escuro';
    if (button.id === 'dark-mode-button') button.textContent = dark ? '☀' : '☾';
    if (button.id === 'library-dark-mode' || button.id === 'memory-dark' || button.classList.contains('home-theme')) button.textContent = dark ? '☀ Tema claro' : '☾ Tema escuro';
  });
}
setTheme(localStorage.getItem('contaCombateTheme') === 'dark');

// Remove telas temporárias como a biblioteca e o jogo de memória para evitar sobreposição.
function clearTransientScreens() {
  document.querySelectorAll('.game-library, .memory-screen').forEach((element) => element.remove());
  if (document.body) {
    document.body.classList.remove('library-active', 'memory-active');
  }
}

// Cria a biblioteca de jogos, onde o usuário escolhe entre o jogo principal e o jogo secundário.
function createGameLibrary(nickname) {
  const existing = $('.game-library');
  if (existing) {
    existing.remove();
  }
  if (document.querySelector('.memory-screen')) {
    document.querySelector('.memory-screen').remove();
  }
  if (document.body && document.body.classList.contains('library-active')) {
    return;
  }
  clearTransientScreens();
  if (!document.body) return;
  document.body.classList.add('library-active');
  const library = document.createElement('section');
  library.className = 'game-library';
  library.innerHTML = `<div class="library-card"><div class="library-top"><div><p class="eyebrow">BIBLIOTECA GUILF TECH</p><h1>Escolha sua missão</h1><p>Olá, ${escapeHTML(nickname)}! Qual desafio você quer jogar?</p></div><div class="library-top-actions"><button type="button" id="library-dark-mode" class="library-theme-button" aria-pressed="false">☾ Tema escuro</button><button type="button" class="library-close" aria-label="Fechar biblioteca">×</button></div></div><div class="library-games"><article class="library-game featured"><div><span class="game-tag">JOGO PRINCIPAL</span><h2>Conta & Combate</h2><p>Resolva contas, ataque a máquina e conquiste a vitória.</p><button type="button" data-game="battle">Jogar agora <span>→</span></button></div></article><article class="library-game memory-game"><div><span class="game-tag">JOGO SECUNDÁRIO</span><h2>Memória dos Números</h2><p>Encontre cartas com números iguais.</p><button type="button" data-game="memory">Jogar memória <span>→</span></button></div></article></div><div class="library-footer"><span>Seu progresso e resultados são vinculados à sua conta.</span><button type="button" class="library-dashboard-button">Voltar ao painel</button><button type="button" class="account-library-button">Sair da conta</button></div></div>`;
  document.body.prepend(library);
  setTheme(document.body.classList.contains('dark-mode'));
  const close = () => {
    library.remove();
    if (document.body) {
      document.body.classList.remove('library-active');
    }
  };
  library.querySelector('.library-close').addEventListener('click', close);
  library.querySelector('.library-dashboard-button').addEventListener('click', async () => {
    close();
    await restoreSession();
  });
  library.querySelector('#library-dark-mode').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  library.querySelector('[data-game="battle"]').addEventListener('click', close);
  library.querySelector('[data-game="memory"]').addEventListener('click', () => {
    close();
    clearTransientScreens();
    startMemoryGame(nickname);
  });
  library.querySelector('.account-library-button').addEventListener('click', signOut);
}

async function signOut() {
  const response = await apiRequest('logout', {}, 'POST');
  if (!response || !response.success) {
    toast('Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.');
    return;
  }
  state.active = false;
  clearTimeout(state.machineTimer);
  clearTimeout(state.transitionTimer);
  clearInterval(state.questionTimer);
  clearInterval(state.memoryTimer);
  setInteractive(false);
  localStorage.removeItem(SESSION_USER_KEY);
  const home = $('.home-screen');
  if (home) home.remove();
  document.body.classList.remove('home-active');
  clearTransientScreens();
  document.querySelectorAll('.professor-panel').forEach((panel) => panel.remove());
  const accountButton = $('#account-button');
  if (accountButton) accountButton.hidden = true;
  createAuthScreen();
}

// Cria a tela inicial do painel do usuário com os jogos principais e ações rápidas.
function createHomeScreen(nickname, role = 'student') {
  const existing = $('.home-screen');
  if (existing) existing.remove();
  document.body.classList.add('home-active');
  const home = document.createElement('section');
  home.className = 'home-screen';
  const panelLabel = role === 'admin' ? 'Painel do Admin' : 'Painel do Professor';
  const professorButton = role === 'professor' || role === 'admin' ? `<button type="button" class="home-professor">${panelLabel}</button>` : '';
  home.innerHTML = `<div class="home-card"><div class="home-heading"><img class="home-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><span class="home-brand-name">GUILF TECH <i>/</i> CONTA &amp; COMBATE</span><button type="button" class="home-logout">Sair</button></div><div class="home-intro"><p class="eyebrow">ARENA MATEMÁTICA · ENSINO FUNDAMENTAL II</p><h1>Olá, ${escapeHTML(nickname)}!</h1><p class="home-motto">"Cada desafio é uma nova chance de mostrar o que você consegue."</p><p class="home-subtitle">Escolha sua aventura e dê o primeiro passo.</p></div><section class="student-dashboard" aria-labelledby="dashboard-title"><div class="dashboard-heading"><div><h2 id="dashboard-title">Painel de evolução</h2></div><span class="dashboard-loading" role="status">Carregando seus dados...</span></div><div class="dashboard-stats" aria-live="polite"></div><div class="learning-trail"><h3>Trilha de aprendizagem</h3><p>Avance nos desafios que já fazem parte da plataforma.</p><div class="learning-progress"></div></div><div class="dashboard-columns"><section><h3>Conquistas</h3><div class="dashboard-achievements"></div></section><section><h3>Partidas recentes</h3><div class="dashboard-history"></div></section></div><section class="dashboard-mistakes"><h3>Respostas para revisar</h3><div class="dashboard-recent-errors"></div></section><p class="dashboard-error-summary"></p><form class="profile-form"><h3>Meu perfil</h3><p class="profile-email">E-mail de acesso: ${escapeHTML(getCurrentUser()?.email || '')}</p><label for="profile-name">Nome de exibição</label><input id="profile-name" name="name" maxlength="50" required value="${escapeHTML(nickname)}"><label for="profile-current-password">Senha atual <small>(necessária para trocar a senha)</small></label><input id="profile-current-password" name="current_password" type="password" autocomplete="current-password"><label for="profile-new-password">Nova senha <small>(mínimo de 8 caracteres)</small></label><input id="profile-new-password" name="new_password" type="password" minlength="8" autocomplete="new-password"><button type="submit">Salvar perfil</button><p class="profile-message" role="status"></p></form></section><div class="home-games"><button type="button" class="home-game home-battle"><img src="assets/math-book.svg" alt=""><span><strong>Conta & Combate</strong><small>Resolva desafios e enfrente a máquina.</small></span><b>Jogar →</b></button><button type="button" class="home-game home-memory"><img src="assets/memory-cards.svg" alt=""><span><strong>Memória dos Números</strong><small>Encontre os pares de números iguais.</small></span><b>Jogar →</b></button></div><div class="home-actions"><button type="button" class="home-library">Ver biblioteca</button>${professorButton}<button type="button" class="home-theme">☾ Tema escuro</button></div></div>`;
  home.querySelector('.student-dashboard')?.remove();
  document.body.prepend(home);
  loadQuestionBank();
  ['battle-easy', 'battle-medium', 'battle-hard', 'memory'].forEach((game) => {
    loadRankingFromServer(game).then(() => {
      renderDifficultyRanking();
      renderRanking($('.main-ranking'), battleRankingGame());
    });
  });
  const leave = () => { home.remove(); document.body.classList.remove('home-active'); };
  home.querySelector('.home-battle').addEventListener('click', leave);
  home.querySelector('.home-memory').addEventListener('click', () => { leave(); clearTransientScreens(); startMemoryGame(nickname); });
  home.querySelector('.home-library').addEventListener('click', () => { leave(); createGameLibrary(nickname); });
  if (role === 'professor' || role === 'admin') home.querySelector('.home-professor').addEventListener('click', () => { leave(); createProfessorPanel(); });
  home.querySelector('.home-theme').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
  home.querySelector('.home-logout').addEventListener('click', signOut);
}

// Busca o banco de perguntas no backend para alimentar o jogo principal.
async function loadQuestionBank() {
  const response = await apiRequest('questions', {}, 'GET');
  if (!response || !response.success || !Array.isArray(response.items)) return [];
  state.questionBank = response.items.map((item) => ({
    id: Number(item.id), difficulty: item.difficulty, question: String(item.question), answer: Number(item.answer),
    display: String(item.question), speech: String(item.question)
  }));
  return state.questionBank;
}

// Salva uma questão nova no backend, usada pelo painel do professor/admin.
async function saveQuestion(item) {
  const payload = { difficulty: item.difficulty, question: item.question, answer: Number(item.answer) };
  if (item.id) payload.id = item.id;
  return apiRequest('questions', payload, 'POST');
}

// Cria o painel do professor/admin para visualizar erros e gerenciar perguntas.
function createProfessorPanel() {
  const existing = $('.professor-panel');
  if (existing) { existing.remove(); return; }
  const user = getCurrentUser();
  if (!user || !['professor', 'admin'].includes(user.role)) return;
  const isAdmin = user.role === 'admin';
  const panel = document.createElement('section');
  panel.className = 'professor-panel';
  panel.innerHTML = `<div class="professor-card"><header><div><p class="eyebrow">ÁREA DOCENTE</p><h1>${isAdmin ? 'Painel do Admin' : 'Painel do Professor'}</h1><p>${isAdmin ? 'Gerencie perguntas, erros e conteúdo do jogo.' : 'Consulte e gerencie os erros dos alunos.'}</p></div><button type="button" class="professor-close" aria-label="Fechar painel">×</button></header><div class="professor-controls"><label for="professor-search">Buscar</label><input id="professor-search" type="search" placeholder="Aluno, conta ou resposta"><button type="button" id="professor-refresh">Atualizar</button></div><div class="professor-error-tabs"><button type="button" class="professor-error-tab active" data-admin-tab="errors">Erros</button>${isAdmin ? '<button type="button" class="professor-error-tab" data-admin-tab="questions">Perguntas</button>' : ''}</div>${isAdmin ? `<form class="professor-question-form" id="question-form"><label for="question-difficulty">Dificuldade</label><select id="question-difficulty"><option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option></select><label for="question-text">Pergunta</label><input id="question-text" type="text" maxlength="180" placeholder="Ex.: 6 × 4 = ?" required><label for="question-answer">Resposta</label><input id="question-answer" type="number" step="any" required><button type="submit">Criar pergunta</button></form><div id="question-list" class="professor-question-list"></div>` : ''}<div id="professor-errors" class="professor-errors"><p class="professor-loading">Carregando erros...</p></div></div>`;
  document.body.prepend(panel);
  const render = async () => {
    const response = await apiRequest('errors', { user_id: user.id, search: $('#professor-search').value }, 'GET');
    const list = $('#professor-errors');
    if (!response || !response.success || !Array.isArray(response.items)) {
      list.innerHTML = '<p class="professor-empty">Não foi possível carregar os erros.</p>';
      return;
    }
    if (!response.items.length) {
      list.innerHTML = '<p class="professor-empty">Nenhum erro registrado.</p>';
      return;
    }
    list.innerHTML = response.items.map((item) => `<article class="professor-error"><div><span class="professor-status status-${item.status}">${item.status}</span><strong>${escapeHTML(item.student_name)}</strong><small>${escapeHTML(item.difficulty)} · ${new Date(item.created_at).toLocaleDateString('pt-BR')}</small></div><p><b>Conta:</b> ${escapeHTML(item.question)}</p><p><b>Aluno:</b> ${escapeHTML(item.student_answer)} · <b>Correto:</b> ${escapeHTML(item.correct_answer)}</p><div class="professor-error-actions"><select data-status="${item.id}"><option value="open" ${item.status === 'open' ? 'selected' : ''}>Aberto</option><option value="fixed" ${item.status === 'fixed' ? 'selected' : ''}>Corrigido</option><option value="closed" ${item.status === 'closed' ? 'selected' : ''}>Fechado</option></select><button type="button" data-delete="${item.id}">Excluir</button></div></article>`).join('');
    list.querySelectorAll('[data-status]').forEach((select) => select.addEventListener('change', async () => {
      await apiRequest('error_update', { id: Number(select.dataset.status), user_id: user.id, status: select.value, note: '' }, 'POST');
      render();
    }));
    list.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Excluir este registro de erro?')) return;
      await apiRequest('error_delete', { id: Number(button.dataset.delete), user_id: user.id }, 'POST');
      render();
    }));
  };
  const renderQuestions = async () => {
    const questions = await loadQuestionBank();
    const list = $('#question-list');
    if (!questions.length) {
      list.innerHTML = '<p class="professor-empty">Nenhuma pergunta cadastrada.</p>';
      return;
    }
    list.innerHTML = questions.map((item) => `<article class="professor-question"><div><p>${escapeHTML(item.question)} = ${escapeHTML(item.answer)}</p><small>${escapeHTML(item.difficulty)}</small></div><div class="professor-question-actions"><button type="button" data-edit-question="${item.id}">Editar</button><button type="button" class="delete" data-delete-question="${item.id}">Excluir</button></div></article>`).join('');
    list.querySelectorAll('[data-edit-question]').forEach((button) => button.addEventListener('click', () => {
      const item = questions.find((question) => question.id === Number(button.dataset.editQuestion));
      if (!item) return;
      $('#question-difficulty').value = item.difficulty;
      $('#question-text').value = item.question;
      $('#question-answer').value = item.answer;
      $('#question-form').dataset.editId = String(item.id);
      $('#question-form button').textContent = 'Atualizar pergunta';
    }));
    list.querySelectorAll('[data-delete-question]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Excluir esta pergunta do jogo?')) return;
      await apiRequest('questions', { id: Number(button.dataset.deleteQuestion) }, 'DELETE');
      renderQuestions();
    }));
  };
  const showTab = (tab) => {
    $$('.professor-error-tab').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === tab));
    const isQuestions = isAdmin && tab === 'questions';
    $('#professor-errors').hidden = isQuestions;
    $('#question-form').hidden = !isQuestions;
    $('#question-list').hidden = !isQuestions;
    if (isQuestions) renderQuestions();
    else render();
  };
  panel.querySelector('.professor-close').addEventListener('click', () => panel.remove());
  panel.querySelector('#professor-refresh').addEventListener('click', () => isAdmin ? renderQuestions() : render());
  panel.querySelector('#professor-search').addEventListener('input', render);
  panel.querySelectorAll('.professor-error-tab').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.adminTab)));
  if (isAdmin) {
    panel.querySelector('#question-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = panel.querySelector('#question-form');
      const item = { id: Number(form.dataset.editId || 0), difficulty: $('#question-difficulty').value, question: $('#question-text').value.trim(), answer: Number($('#question-answer').value) };
      if (!item.question || !Number.isFinite(item.answer)) return toast('Informe uma pergunta e uma resposta válidas.');
      await saveQuestion(item);
      form.reset();
      form.dataset.editId = '';
      form.querySelector('button').textContent = 'Criar pergunta';
      renderQuestions();
      toast(item.id ? 'Pergunta atualizada.' : 'Pergunta criada.');
    });
  }
  document.body.prepend(panel);
  if (isAdmin) {
    $('#question-form').hidden = true;
    $('#question-list').hidden = true;
  }
  render();
  if (isAdmin) renderQuestions();
}

// Inicia o jogo de memória, montando a tela de cartas, ranking e controles do jogo.
function startMemoryGame(nickname) {
  const existingMemory = document.querySelector('.memory-screen');
  if (existingMemory) {
    existingMemory.remove();
  }
  if (document.querySelector('.game-library')) {
    document.querySelector('.game-library').remove();
  }
  clearTransientScreens();
  if (!document.body) return;
  document.body.classList.add('memory-active');
  const overlay = document.createElement('section');
  overlay.className = 'memory-screen';
  overlay.innerHTML = `<div class="memory-card"><div class="memory-top-actions"><button type="button" id="memory-support" aria-pressed="false">♥ Modo de apoio</button><button type="button" id="memory-dark" aria-label="Ativar modo escuro">☾ Modo escuro</button><button type="button" id="memory-accessibility" aria-label="Ativar modo acessível">Aa Acessibilidade</button><button type="button" id="memory-account">Sair da conta</button></div><div class="memory-header"><div><span class="game-tag">MEMÓRIA DOS NÚMEROS</span><h1>Encontre os números iguais!</h1><p>Vire duas cartas por vez e encontre os pares com o mesmo número.</p></div><div class="memory-stats"><span class="memory-stat-time">Tempo <strong id="memory-time" aria-live="polite">60s</strong></span><span>Pares <strong id="memory-pairs">0/4</strong></span><span>Jogadas <strong id="memory-moves">0</strong></span><span>Pontos <strong id="memory-score">0</strong></span><span>Recorde <strong id="memory-best">0</strong></span></div></div><div class="memory-guide" aria-label="Instruções do jogo"><strong>Como jogar</strong><span><b>1</b> Vire uma carta</span><span><b>2</b> Vire outra carta</span><span><b>3</b> Encontre números iguais</span><span><b>4</b> Complete todos os pares</span></div><div class="memory-difficulty"><span>Nível:</span><button type="button" class="memory-level active" data-memory-level="easy">Fácil <small>4 pares</small></button><button type="button" class="memory-level" data-memory-level="medium">Médio <small>6 pares</small></button><button type="button" class="memory-level" data-memory-level="hard">Difícil <small>8 pares</small></button></div><div class="memory-help"><strong>Dica</strong><span>Observe a posição das cartas e jogue com calma. Você pode recomeçar quando quiser.</span></div><div class="memory-game-actions"><button type="button" id="memory-play" class="memory-play-button">▶ Jogar</button><button type="button" id="memory-pause" disabled>Ⅱ Pausar</button><button type="button" id="memory-restart">↻ Reiniciar</button><button type="button" id="memory-menu">← Sair para o menu</button></div><div class="memory-motivation" aria-live="polite"><span aria-hidden="true">✦</span><strong id="memory-motivation">Você consegue! Observe bem as cartas.</strong></div><div id="memory-board" class="memory-board"></div><p id="memory-feedback" class="memory-feedback">Clique em Jogar para começar.</p><div id="memory-result" class="memory-result"></div><button type="button" id="memory-exit">Voltar à biblioteca</button></div>`;
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
  const pairsByLevel = {
    easy: [['12', '12'], ['18', '18'], ['42', '42'], ['7', '7']],
    medium: [['9', '9'], ['7', '7'], ['20', '20'], ['18', '18'], ['8', '8'], ['6', '6']],
    hard: [['4', '4'], ['8', '8'], ['25', '25'], ['30', '30'], ['12', '12'], ['32', '32'], ['20', '20'], ['15', '15']]
  };
  let pairs = pairsByLevel[memoryLevel];
  let firstCard = null; let locked = false; let matched = 0; let moves = 0; let score = 0; let memorySeconds = 60; let memoryTimer = null; let memoryStarted = false; let supportMode = false; let gameReady = false; let gamePaused = false; let rankingSaved = false; let matchSaved = false; let memoryInitialSeconds = 60;
  const bestKey = 'contaCombateMemoryBest'; const bestScore = Number(localStorage.getItem(bestKey) || 0); $('#memory-best').textContent = bestScore;
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id) {
    apiRequest('settings', { user_id: currentUser.id }, 'GET').then((response) => {
      if (response && response.success && response.settings && Number(response.settings.memory_best) > 0) {
        $('#memory-best').textContent = Number(response.settings.memory_best);
        localStorage.setItem('contaCombateMemoryBest', String(response.settings.memory_best));
      }
    });
  }
  let cards;
  const board = $('#memory-board');
  const timeByLevel = { easy: 45, medium: 35, hard: 25 };
  const stopMemoryTimer = () => { clearInterval(memoryTimer); memoryTimer = null; state.memoryTimer = null; };
  const updateMemoryTime = () => { $('#memory-time').textContent = `${memorySeconds}s`; $('#memory-time').parentElement.classList.toggle('urgent', memorySeconds <= 10); };
  const setMotivation = (message) => { $('#memory-motivation').textContent = message; };
  const getMemoryName = () => $('#memory-player-name').value.trim() || 'Jogador 1';
  const recordMemoryMatch = (won) => {
    if (matchSaved) return;
    matchSaved = true;
    apiRequest('save_match', { game: 'memory', won, score, difficulty: memoryLevel, correct_answers: matched }, 'POST');
    if (won && !rankingSaved) {
      rankingSaved = true;
      saveRanking(getMemoryName(), memoryInitialSeconds - memorySeconds, 'memory');
    }
    renderRanking(memoryRanking, 'memory');
  };
  const startMemoryTimer = () => { if (memoryStarted) return; memoryStarted = true; setMotivation('Respire fundo e confie na sua memória!'); memoryTimer = setInterval(() => { memorySeconds -= 1; updateMemoryTime(); if (memorySeconds <= 10 && memorySeconds > 0) setMotivation('Você ainda consegue! Foque em uma carta por vez.'); if (memorySeconds <= 0) { stopMemoryTimer(); locked = true; board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = true; }); $('#memory-feedback').textContent = 'O tempo acabou!'; $('#memory-feedback').className = 'memory-feedback error'; setMotivation('Tudo bem! Cada tentativa ajuda você a melhorar.'); $('#memory-result').innerHTML = `<strong>Fim de jogo</strong> Você encontrou ${matched} de ${pairs.length} pares.`; recordMemoryMatch(false); playTone(150, 0.2); } }, 1000); state.memoryTimer = memoryTimer; };
  const setupBoard = () => {
    stopMemoryTimer(); memorySeconds = timeByLevel[memoryLevel] + (supportMode ? 30 : 0); memoryInitialSeconds = memorySeconds; memoryStarted = false; rankingSaved = false; matchSaved = false; pairs = pairsByLevel[memoryLevel]; matched = 0; moves = 0; score = 0; firstCard = null; locked = false; cards = pairs.flatMap(([firstValue, secondValue], index) => [{ value: firstValue, pair: index }, { value: secondValue, pair: index }]).sort(() => Math.random() - .5);
    $('#memory-pairs').textContent = `0/${pairs.length}`; $('#memory-moves').textContent = '0'; $('#memory-score').textContent = '0'; $('#memory-result').textContent = '';
    updateMemoryTime();
    board.innerHTML = cards.map((card, index) => `<button class="memory-tile" type="button" data-index="${index}" aria-label="Carta ${index + 1}, número oculto" disabled><span class="memory-front" aria-hidden="true">?</span><span class="memory-back">${escapeHTML(card.value)}</span></button>`).join('');
    if (gameReady) board.querySelectorAll('.memory-tile').forEach((tile) => { tile.disabled = false; });
    board.querySelectorAll('.memory-tile').forEach((tile) => tile.addEventListener('click', () => {
    if (!gameReady || gamePaused || locked || tile.classList.contains('flipped') || tile.classList.contains('matched')) return;
    startMemoryTimer();
    tile.classList.add('flipped');
    tile.setAttribute('aria-label', `Carta ${Number(tile.dataset.index) + 1}, número ${cards[Number(tile.dataset.index)].value}`);
    if (!firstCard) { firstCard = tile; return; }
    moves += 1; $('#memory-moves').textContent = moves; locked = true;
    const secondCard = tile; const first = cards[Number(firstCard.dataset.index)]; const second = cards[Number(secondCard.dataset.index)];
    if (first.pair === second.pair) { firstCard.classList.add('matched'); secondCard.classList.add('matched'); matched += 1; score += Math.max(40, 140 - moves * 5); $('#memory-score').textContent = score; $('#memory-pairs').textContent = `${matched}/${pairs.length}`; $('#memory-feedback').textContent = `Par de números ${first.value} encontrado. Muito bem!`; $('#memory-feedback').className = 'memory-feedback success'; setMotivation(matched === pairs.length - 1 ? 'Está quase! O último par está esperando por você!' : 'Muito bem! Sua memória está ficando mais forte.'); playTone(740); locked = false; firstCard = null; if (matched === pairs.length) { stopMemoryTimer(); recordMemoryMatch(true); setMotivation('Você venceu! Que concentração incrível!'); if (score > Number(localStorage.getItem(bestKey) || 0)) { localStorage.setItem(bestKey, String(score)); if (currentUser && currentUser.id) apiRequest('settings', { memory_best: score }, 'POST'); } $('#memory-result').innerHTML = `<img src="assets/trophy.svg" alt="Troféu"><strong>Parabéns, ${escapeHTML(getMemoryName())}!</strong> Você venceu com ${score} pontos em ${moves} jogadas.`; } }
    else { $('#memory-feedback').textContent = 'Esses números são diferentes. Tente outra combinação!'; $('#memory-feedback').className = 'memory-feedback error'; const currentUser = getCurrentUser(); if (currentUser && currentUser.id) { apiRequest('save_error', { question: `Encontre o par do número ${first.value}`, student_answer: second.value, correct_answer: first.value, difficulty: memoryLevel }, 'POST'); } setMotivation('Sem problema! Errar faz parte de aprender.'); playTone(180); setTimeout(() => { firstCard.classList.remove('flipped'); secondCard.classList.remove('flipped'); firstCard.setAttribute('aria-label', `Carta ${Number(firstCard.dataset.index) + 1}, número oculto`); secondCard.setAttribute('aria-label', `Carta ${Number(secondCard.dataset.index) + 1}, número oculto`); locked = false; firstCard = null; }, 800); }
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
  $('#memory-account').addEventListener('click', () => { stopMemoryTimer(); overlay.remove(); document.body.classList.remove('memory-active'); signOut(); });
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
  // Tela de autenticação com login, cadastro e recuperação de senha.
  auth.innerHTML = '<div class="auth-card"><img class="auth-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><p class="eyebrow">ARENA MATEMÁTICA</p><h1 id="auth-title">Bem-vindo!</h1><p class="auth-subtitle">Entre para continuar sua jornada.</p><div class="auth-tabs"><button type="button" class="auth-tab active" data-auth-mode="login">Entrar</button><button type="button" class="auth-tab" data-auth-mode="register">Criar cadastro</button></div><form id="auth-form"><label for="auth-name" class="register-only">Seu nick</label><input id="auth-name" class="register-only" type="text" maxlength="50" placeholder="Como quer ser chamado?" autocomplete="nickname"><label for="auth-email">E-mail</label><input id="auth-email" type="email" placeholder="seu@email.com" autocomplete="email" required><label for="auth-password">Senha</label><input id="auth-password" type="password" minlength="8" placeholder="Mínimo de 8 caracteres" autocomplete="current-password" required><label for="auth-role">Tipo de conta</label><select id="auth-role"><option value="student">Aluno</option><option value="professor">Professor</option><option value="admin">Admin</option></select><label for="auth-professor-code" class="register-only professor-code-field">Código de Professor</label><input id="auth-professor-code" class="register-only professor-code-field" type="password" placeholder="Digite o código" autocomplete="off"><button class="auth-submit" type="submit">Entrar na arena <span>→</span></button><button type="button" class="auth-forgot-password" id="auth-forgot-password">Preciso de ajuda para acessar</button><p id="auth-message" class="auth-message" role="alert"></p></form><small class="auth-note">As contas e o progresso são vinculados ao banco de dados.</small></div>';
  document.body.prepend(auth);
  if (!$('#account-button')) {
    const accountButton = document.createElement('button');
    accountButton.id = 'account-button';
    accountButton.className = 'account-button';
    accountButton.type = 'button';
    accountButton.textContent = 'Sair';
    accountButton.hidden = true;
    accountButton.addEventListener('click', signOut);
    $('.top-actions').prepend(accountButton);
  }
  let mode = 'login';
  const name = $('#auth-name');
  const email = $('#auth-email');
  const password = $('#auth-password');
  const role = $('#auth-role');
  const professorCode = $('#auth-professor-code');
  const message = $('#auth-message');
  const setMode = (nextMode) => {
    mode = nextMode;
    const register = mode === 'register';
    auth.classList.toggle('auth-register', register);
    $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
    $$('.register-only').forEach((field) => field.classList.toggle('visible', register));
    name.required = register;
    password.minLength = register ? 8 : 1;
    password.placeholder = register ? 'Mínimo de 8 caracteres' : 'Sua senha';
    role.required = true;
    role.querySelector('option[value="admin"]').hidden = register;
    if (register && role.value === 'admin') role.value = 'student';
    professorCode.closest('.professor-code-field').classList.toggle('visible', register && role.value === 'professor');
    $('#auth-title').textContent = register ? 'Crie sua conta' : 'Bem-vindo!';
    $('.auth-subtitle').textContent = register ? 'Prepare seu perfil para a próxima batalha.' : 'Entre para continuar sua jornada.';
    $('.auth-submit').innerHTML = register ? 'Criar conta <span>→</span>' : 'Entrar na arena <span>→</span>';
    message.textContent = '';
  };
  $$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.authMode)));
  role.addEventListener('change', () => {
    professorCode.closest('.professor-code-field').classList.toggle('visible', mode === 'register' && role.value === 'professor');
  });
  $('#auth-forgot-password').addEventListener('click', () => {
    message.textContent = 'A recuperação automática ainda não está configurada. Peça ajuda ao professor ou administrador.';
  });

  $('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const normalizedEmail = email.value.trim().toLowerCase();
    if (mode === 'register') {
      const response = await apiRequest('register', {
        name: name.value.trim(),
        email: normalizedEmail,
        password: password.value,
        role: role.value,
        professor_code: role.value === 'professor' ? professorCode.value : ''
      }, 'POST');

      if (!response || !response.success) {
        message.textContent = response?.message || 'Não foi possível conectar ao servidor. Verifique o Apache e o banco de dados.';
        return;
      }
      message.textContent = 'Cadastro criado com segurança. Entre com sua conta para continuar.';
      setMode('login');
      email.value = normalizedEmail;
      password.value = '';
      return;
    }

    const response = await apiRequest('login', {
      email: normalizedEmail,
      password: password.value,
      role: role.value
    }, 'POST');
    if (response && response.success) {
      const user = response.user;
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      $('#account-button').hidden = false;
      if (response.settings) {
        localStorage.setItem('contaCombateTheme', response.settings.theme || 'light');
        document.body.classList.toggle('dark-mode', response.settings.theme === 'dark');
      }
      $('#nickname-input').value = user.name;
      auth.classList.add('authenticated');
      setTimeout(() => { auth.remove(); createHomeScreen(user.name, user.role || 'student'); }, 350);
      return;
    }
    message.textContent = response?.message || 'Não foi possível conectar ao servidor. Verifique o Apache e o banco de dados.';
  });
}
function createAccessibilityButton() {
  if ($('#accessibility-toolbar')) return;
  const toolbar = document.createElement('nav');
  toolbar.id = 'accessibility-toolbar';
  toolbar.className = 'accessibility-toolbar';
  toolbar.setAttribute('aria-label', 'Opções de acessibilidade');
  toolbar.innerHTML = '<button type="button" class="accessibility-zoom-button" id="zoom-out" aria-label="Diminuir tamanho da tela">A−</button><span id="zoom-level" aria-live="polite">100%</span><button type="button" class="accessibility-zoom-button" id="zoom-in" aria-label="Aumentar tamanho da tela">A+</button><button type="button" id="accessibility-button" aria-pressed="false" aria-label="Ativar alto contraste e reduzir animações" title="Alto contraste e menos animações">◐</button><button type="button" id="accessibility-fullscreen" aria-label="Ativar tela cheia" title="Tela cheia">⛶</button>';
  document.body.append(toolbar);

  const zoomSteps = [100, 110, 120, 130, 140, 150];
  const savedZoom = Number(localStorage.getItem('contaCombateZoom'));
  let zoom = zoomSteps.includes(savedZoom) ? savedZoom : 100;
  const updateZoom = () => {
    document.documentElement.style.zoom = `${zoom}%`;
    toolbar.querySelector('#zoom-level').textContent = `${zoom}%`;
    toolbar.querySelector('#zoom-out').disabled = zoom === zoomSteps[0];
    toolbar.querySelector('#zoom-in').disabled = zoom === zoomSteps[zoomSteps.length - 1];
    localStorage.setItem('contaCombateZoom', String(zoom));
  };
  toolbar.querySelector('#zoom-out').addEventListener('click', () => {
    zoom = zoomSteps[Math.max(0, zoomSteps.indexOf(zoom) - 1)];
    updateZoom();
  });
  toolbar.querySelector('#zoom-in').addEventListener('click', () => {
    zoom = zoomSteps[Math.min(zoomSteps.length - 1, zoomSteps.indexOf(zoom) + 1)];
    updateZoom();
  });
  toolbar.querySelector('#accessibility-button').addEventListener('click', (event) => {
    const enabled = document.body.classList.toggle('accessibility-mode');
    event.currentTarget.setAttribute('aria-pressed', String(enabled));
    toast(enabled ? 'Alto contraste e redução de animações ativados.' : 'Modo acessível desativado.');
  });
  toolbar.querySelector('#accessibility-fullscreen').addEventListener('click', (event) => toggleFullscreen(event.currentTarget));
  updateZoom();
}

async function newQuestion() {
  const bank = state.questionBank.filter((item) => item.difficulty === state.difficulty);
  let display; let answer; let speech; let explanation;
  if (bank.length > 0) {
    const item = bank[Math.floor(Math.random() * bank.length)];
    display = item.display; answer = item.answer; speech = item.speech;
    explanation = 'Observe a operação apresentada e confira o resultado correto para entender o desafio.';
  } else if (state.difficulty === 'easy') {
    const first = Math.floor(Math.random() * 9) + 2;
    const second = Math.floor(Math.random() * 9) + 2;
    answer = first * second; display = `${first} × ${second} = ?`; speech = `Quanto é ${first} vezes ${second}?`;
    explanation = `${first} grupos de ${second} formam ${answer}.`;
  } else if (state.difficulty === 'medium') {
    const powerMode = Math.random() < 0.5;
    if (powerMode) {
      const base = Math.floor(Math.random() * 8) + 2;
      answer = base * base; display = `${base}² = ?`; speech = `Quanto é ${base} elevado ao quadrado?`;
      explanation = `${base}² significa ${base} × ${base}, que é igual a ${answer}.`;
    } else {
      const root = Math.floor(Math.random() * 9) + 2;
      answer = root; display = `√${root * root} = ?`; speech = `Qual é a raiz quadrada de ${root * root}?`;
      explanation = `A raiz quadrada de ${root * root} é ${answer}, pois ${answer} × ${answer} = ${root * root}.`;
    }
  } else {
    const coefficient = Math.floor(Math.random() * 5) + 2;
    answer = Math.floor(Math.random() * 9) + 1;
    const constant = Math.floor(Math.random() * 10) + 1;
    const result = coefficient * answer + constant;
    display = `${coefficient}x + ${constant} = ${result}`;
    speech = `Qual é o valor de x? ${coefficient} vezes x mais ${constant} é igual a ${result}.`;
    explanation = `Subtraia ${constant} dos dois lados: ${coefficient}x = ${result - constant}. Depois divida por ${coefficient}; x = ${answer}.`;
  }
  state.question = { answer, speech, display, explanation };
  state.answerLocked = false;
  $('#equation').textContent = display;
  $('#equation').setAttribute('aria-label', speech);
  $('#question-number').textContent = String(state.questionIndex + 1).padStart(2, '0');
  $('#round-label').textContent = `RODADA ${String(state.questionIndex + 1).padStart(2, '0')}`;
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
  $('#player-health-bar').style.width = `${(state.playerHealth / config.startingHealth) * 100}%`;
  $('#opponent-health-bar').style.width = `${(state.opponentHealth / state.maxOpponentHealth) * 100}%`;
  $('#player-health-text').textContent = `${state.playerHealth} / ${config.startingHealth}`;
  $('#opponent-health-text').textContent = `${state.opponentHealth} / ${state.maxOpponentHealth}`;
  $('#streak-value').textContent = state.streak;
  $('#score-value').textContent = state.score;
  $('#question-timer').textContent = `${state.questionSeconds}s`;
  $('.streak-badge').setAttribute('aria-label', `Sequência atual de ${state.streak} acertos`);
  setInteractive(state.active && !state.paused);
}
function setInteractive(enabled) {
  const canAnswer = enabled && state.active && !state.paused && !state.answerLocked;
  $('#answer-input').disabled = !canAnswer;
  $('#attack-button').disabled = !canAnswer;
  $$('#choice-grid button').forEach((button) => { button.disabled = !canAnswer; });
  $('#shield-button').disabled = !canAnswer || state.shield;
  $('#heal-button').disabled = !canAnswer || state.playerHealth >= config.startingHealth;
  $('#power-button').disabled = !canAnswer || state.score < 200 || state.opponentHealth <= 0;
  $('#pause-button').disabled = !state.active || state.answerLocked;
  $('#training-button').disabled = state.active;
  $$('.mode-card').forEach((card) => { card.disabled = state.active; });
  $('#start-button').disabled = state.active;
}
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
  $('#training-button').setAttribute('aria-pressed', 'false');
  const heroImages = { raio: 'character-raio.svg', foguete: 'character-foguete.svg', mente: 'character-mente.svg', guardiao: 'hero-guardiao.svg', maga: 'hero-maga.svg', ninja: 'hero-ninja.svg' };
  $$('.character-select button').forEach((button) => { const label = button.textContent; button.innerHTML = `<img src="assets/${heroImages[button.dataset.character]}" alt="">${label}`; });
  $('#shield-button').addEventListener('click', () => { if (!state.active || state.paused || state.answerLocked || state.shield) return; state.shield = true; setInteractive(true); toast('Escudo ativado!'); });
  $('#heal-button').addEventListener('click', () => { if (!state.active || state.playerHealth >= config.startingHealth) return; state.playerHealth = Math.min(config.startingHealth, state.playerHealth + 20); updateHealth(); toast('Você recuperou 20 de energia!'); });
  $('#power-button').addEventListener('click', () => { if (!state.active || state.score < 200 || !state.opponentHealth) return; state.score -= 200; state.opponentHealth = Math.max(0, state.opponentHealth - 30); updateHealth(); animate('.opponent-card', 'hit-by-player'); toast('Ataque forte! -30 energia'); if (!state.opponentHealth) endGame(); });
  $$('.character-select button').forEach((button) => button.addEventListener('click', () => { setCharacter(button.dataset.character); toast(`Personagem ${button.textContent} escolhido!`); }));
  $('#pause-button').addEventListener('click', togglePause);
  $('#training-button').addEventListener('click', () => {
    if (state.active) return;
    state.training = !state.training;
    $('#training-button').textContent = state.training ? 'Sair do treino' : 'Praticar';
    $('#training-button').setAttribute('aria-pressed', String(state.training));
    toast(state.training ? 'Modo treino ativado. A partida não contará para o ranking.' : 'Modo batalha ativado.');
  });
  $('#restart-button').addEventListener('click', () => {
    if (state.active && !window.confirm('Reiniciar agora? O progresso desta partida será perdido.')) return;
    startGame();
  });
  setInteractive(false);
  const user = getCurrentUser();
  if (user && user.id) {
    apiRequest('history', { user_id: user.id }, 'GET').then((response) => {
      if (response && response.success && Array.isArray(response.items)) {
        const history = response.items.map((item) => ({ won: Boolean(item.won), score: Number(item.score || 0), difficulty: item.difficulty || 'easy', correct: Number(item.correct_answers || 0), date: item.played_at || new Date().toLocaleDateString('pt-BR') }));
        localStorage.setItem('contaCombateHistory', JSON.stringify(history.slice(-20)));
        $('#match-count').textContent = String(history.length);
        $('#best-score').textContent = String(Math.max(0, ...history.map((match) => Number(match.score || 0))));
        return;
      }
    });
  }
  const history = JSON.parse(localStorage.getItem('contaCombateHistory') || '[]');
  $('#match-count').textContent = history.length;
  $('#best-score').textContent = Math.max(0, ...history.map((match) => match.score || 0));
}
function saveMatch(won) {
  const history = JSON.parse(localStorage.getItem('contaCombateHistory') || '[]');
  history.push({ won, score: state.score, difficulty: state.difficulty, correct: state.correctAnswers, date: new Date().toLocaleDateString('pt-BR') });
  localStorage.setItem('contaCombateHistory', JSON.stringify(history.slice(-20)));
  const user = getCurrentUser();
  if (user && user.id) {
    apiRequest('save_match', {
      user_id: user.id,
      game: 'battle',
      won: won ? 1 : 0,
      score: state.score,
      difficulty: state.difficulty,
      correct_answers: state.correctAnswers
    }, 'POST').then((response) => {
      if (response && response.success) {
        apiRequest('history', { user_id: user.id }, 'GET').then((historyResponse) => {
          if (historyResponse && historyResponse.success && Array.isArray(historyResponse.items)) {
            const matches = historyResponse.items.map((item) => ({ won: Boolean(item.won), score: Number(item.score || 0), difficulty: item.difficulty || 'easy', correct: Number(item.correct_answers || 0), date: item.played_at || new Date().toLocaleDateString('pt-BR') }));
            localStorage.setItem('contaCombateHistory', JSON.stringify(matches.slice(-20)));
            $('#match-count').textContent = String(matches.length);
            $('#best-score').textContent = String(Math.max(0, ...matches.map((match) => Number(match.score || 0))));
          }
        });
      }
    });
  }
  $('#match-count').textContent = Math.min(history.length, 20);
  $('#best-score').textContent = Math.max(0, ...history.map((match) => match.score || 0));
}

function submitAnswer(value) {
  if (!state.active || state.paused || state.answerLocked || !state.question) return;
  if (value !== null && !Number.isFinite(value)) {
    showFeedback('Digite uma resposta válida antes de atacar.', 'error');
    $('#answer-input').focus();
    return;
  }
  state.answerLocked = true;
  clearInterval(state.questionTimer);
  clearTimeout(state.machineTimer);
  const correct = value !== null && value === state.question.answer;
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
    const shieldBlocked = state.shield && !state.training;
    const machineDamage = machineAttack();
    const user = getCurrentUser();
    if (user && user.id) {
      apiRequest('save_error', {
        user_id: user.id,
        student_name: $('#player-name').textContent || 'Jogador 1',
        question: state.question.display || state.question.speech || 'Conta matemática',
        student_answer: value === null ? 'Tempo esgotado' : String(value),
        correct_answer: String(state.question.answer),
        difficulty: state.difficulty
      }, 'POST');
    }
    animate('#answer-feedback', 'feedback-shake');
    const reason = value === null ? 'Tempo esgotado!' : 'Quase!';
    const feedback = state.training
      ? `${reason} A resposta era ${state.question.answer}. ${state.question.explanation} No treino, a máquina não ataca.`
      : shieldBlocked
        ? `Seu escudo bloqueou o ataque! A resposta era ${state.question.answer}. ${state.question.explanation}`
        : `A máquina contra-atacou! -${machineDamage} energia. A resposta era ${state.question.answer}. ${state.question.explanation}`;
    speak(`A resposta correta era ${state.question.answer}. ${state.question.explanation}`);
    showFeedback(feedback, 'error');
    playTone(180);
  }
  updateHealth();
  state.questionIndex += 1;
  setInteractive(false);
  if (state.opponentHealth === 0 || state.playerHealth === 0 || state.questionIndex >= config.rounds) {
    endGame();
  } else {
    state.transitionTimer = setTimeout(() => {
      state.transitionTimer = null;
      if (!state.active) return;
      showFeedback('', '');
      newQuestion();
      scheduleMachineAttack();
      setInteractive(true);
      $('#answer-input').focus();
    }, 1100);
  }
}
function endGame() {
  state.active = false; clearTimeout(state.machineTimer); clearTimeout(state.transitionTimer); clearInterval(state.questionTimer); setInteractive(false);
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
  const rankingGame = battleRankingGame();
  if (!state.training) saveRanking(nickname, (Date.now() - state.gameStartedAt) / 1000, rankingGame);
  renderRanking($('.main-ranking'), rankingGame);
  renderDifficultyRanking();
  showFinalReport(won);
  $('#start-button').textContent = 'Jogar novamente →';
  speak(won ? 'Parabéns! Você venceu a batalha.' : 'Fim de jogo. Tente novamente.');
}
function showFinalReport(won) {
  const report = $('#final-report');
  const accuracy = state.questionIndex ? Math.round((state.correctAnswers / state.questionIndex) * 100) : 0;
  const medal = state.training ? 'Treino' : won && accuracy >= 90 ? 'Ouro' : won && accuracy >= 70 ? 'Prata' : won ? 'Bronze' : 'Treino';
  report.innerHTML = `${won ? '<img src="assets/trophy.svg" alt="Troféu de vitória"><img class="victory-stars" src="assets/victory-stars.svg" alt="Estrelas de vitória">' : ''}<strong>${won ? 'Relatório da vitória' : 'Relatório da partida'}</strong><span>Acertos: ${state.correctAnswers}/${state.questionIndex}</span><span>Precisão: ${accuracy}%</span><span>Pontuação: ${state.score}</span><span>Medalha: ${medal}</span>`;
}
function startGame() {
  clearTimeout(state.machineTimer); clearTimeout(state.transitionTimer); clearInterval(state.questionTimer);
  state.active = true; state.paused = false; state.answerLocked = false; state.gameStartedAt = Date.now(); state.questionIndex = 0; state.streak = 0; state.score = 0; state.correctAnswers = 0; state.shield = false; state.playerHealth = config.startingHealth; state.maxOpponentHealth = state.difficulty === 'hard' ? 130 : config.startingHealth; state.opponentHealth = state.maxOpponentHealth;
  $('.arena').classList.remove('game-won', 'game-lost');
  $('#final-report').replaceChildren();
  showFeedback('', '');
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
  renderRanking(ranking, battleRankingGame());
  actions.querySelector('.main-play-again').addEventListener('click', startGame);
  actions.querySelector('.main-library-link').addEventListener('click', () => { if (state.active) { state.active = false; clearTimeout(state.machineTimer); clearTimeout(state.transitionTimer); clearInterval(state.questionTimer); setInteractive(false); } createGameLibrary($('#player-name').textContent || 'Jogador 1'); });
}
function togglePause() {
  if (!state.active) return;
  state.paused = !state.paused;
  if (state.paused) { clearInterval(state.questionTimer); clearTimeout(state.machineTimer); setInteractive(false); $('#pause-button').textContent = 'Continuar'; $('#turn-label').textContent = 'Jogo pausado'; }
  else { $('#pause-button').textContent = 'Pausar'; $('#turn-label').textContent = 'Sua vez de atacar!'; setInteractive(true); startQuestionTimer(); scheduleMachineAttack(); }
}

async function restoreSession() {
  localStorage.removeItem('contaCombateUsers');
  const response = await apiRequest('session', {}, 'GET');
  if (!response || !response.success || !response.authenticated) {
    localStorage.removeItem(SESSION_USER_KEY);
    return;
  }
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(response.user));
  $('#account-button').hidden = false;
  if (response.settings) {
    localStorage.setItem('contaCombateTheme', response.settings.theme || 'light');
    document.body.classList.toggle('dark-mode', response.settings.theme === 'dark');
  }
  const auth = $('.auth-screen');
  if (auth) auth.remove();
  $('#nickname-input').value = response.user.name;
  createHomeScreen(response.user.name, response.user.role || 'student');
}

$$('.mode-card').forEach((card) => card.addEventListener('click', () => {
  if (state.active) return;
  $$('.mode-card').forEach((item) => item.classList.remove('selected'));
  card.classList.add('selected');
  state.difficulty = card.dataset.difficulty;
  $('#opponent-name').textContent = config.soloOpponent;
  $('#opponent-label').textContent = 'MÁQUINA';
  $('#turn-label').textContent = 'Sua vez de atacar!';
}));
$('#start-button').addEventListener('click', startGame);
$('#answer-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#answer-input');
  if (!input.value.trim()) {
    showFeedback('Digite uma resposta antes de atacar.', 'error');
    input.focus();
    return;
  }
  submitAnswer(Number(input.value));
  input.value = '';
});
$('#read-question').addEventListener('click', speakQuestion);
$('#dark-mode-button').addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
$('#fullscreen-button').addEventListener('click', (event) => toggleFullscreen(event.currentTarget));
createNicknameField();
createAccessibilityButton();
addInterfaceImages();
createHeroBrand();
createMainGameActions();
renderDifficultyRanking();
setCharacter(state.character);
$('.character-robot').innerHTML = '<img src="assets/character-robo.svg" alt="Professor Robô">';
createAuthScreen();
updateHealth();
restoreSession();
