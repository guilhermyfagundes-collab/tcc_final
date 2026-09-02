<?php
$gameConfig = require __DIR__ . '/config/game.php';
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#16324f">
  <title><?= htmlspecialchars($gameConfig['title'], ENT_QUOTES, 'UTF-8') ?> | Matemática</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="difficulty.css">
  <link rel="stylesheet" href="effects.css?v=73">
  </head>
<body>
  <a class="skip-link" href="#main-content">Ir para o jogo</a>
  <header class="topbar">
    <div class="brand"><img class="site-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><span>Conta &amp; <strong>Combate</strong></span></div>
    <div class="top-actions">
      <button class="icon-button fullscreen-button" id="fullscreen-button" type="button" aria-label="Ativar tela cheia" title="Tela cheia">⛶</button>
      <button class="icon-button" id="dark-mode-button" type="button" aria-pressed="false" aria-label="Ativar modo escuro" title="Modo escuro">☾</button>
    </div>
  </header>
  <main id="main-content" class="page-shell">
    <section class="intro" aria-labelledby="page-title"><div><p class="eyebrow">MISSÃO DE HOJE <span aria-hidden="true">/</span> FASE 01</p><h1 id="page-title">Aprenda. Ataque.<br><em>Vença.</em></h1><p class="intro-copy">Resolva a conta, lance seu ataque e conquiste a próxima fase!</p></div><div class="streak-badge" aria-label="Sequência atual de 0 acertos"><span class="streak-icon" aria-hidden="true">↗</span><span><strong id="streak-value">0</strong><small>sequência</small></span></div></section>
    <section class="mode-section" aria-labelledby="mode-title"><div class="section-heading"><div><p class="eyebrow">ESCOLHA O DESAFIO</p><h2 id="mode-title">Qual será o nível da máquina?</h2></div><span class="step-label">01 <span aria-hidden="true">—</span> 02</span></div><div class="mode-grid"><button class="mode-card selected" data-difficulty="easy" type="button"><span class="mode-icon solo-icon" aria-hidden="true">×</span><span><strong>Fácil</strong><small>Contas de multiplicação</small></span><span class="radio-dot" aria-hidden="true"></span></button><button class="mode-card" data-difficulty="medium" type="button"><span class="mode-icon duo-icon" aria-hidden="true">√</span><span><strong>Médio</strong><small>Potências e raízes</small></span><span class="radio-dot" aria-hidden="true"></span></button><button class="mode-card" data-difficulty="hard" type="button"><span class="mode-icon duo-icon" aria-hidden="true">x</span><span><strong>Difícil</strong><small>Equações do 1º grau</small></span><span class="radio-dot" aria-hidden="true"></span></button></div></section>
    <section class="arena" aria-labelledby="arena-title"><div class="arena-header"><div><p class="eyebrow">ARENA DE BATALHA</p><h2 id="arena-title">Pronto para o duelo?</h2></div><span class="round-pill" id="round-label">RODADA 01</span></div><div class="fighters"><article class="fighter-card opponent-card"><div class="character character-robot" aria-hidden="true"><span>✦</span></div><div class="fighter-info"><span class="fighter-label" id="opponent-label">OPONENTE</span><h3 id="opponent-name">Professor Robô</h3><div class="health-row"><span>Energia</span><strong id="opponent-health-text">100 / 100</strong></div><div class="health-bar"><span id="opponent-health-bar"></span></div></div></article><div class="versus" aria-label="contra">VS</div><article class="fighter-card player-card"><div class="fighter-info"><span class="fighter-label" id="player-label">VOCÊ</span><h3 id="player-name">Jogador 1</h3><div class="health-row"><span>Energia</span><strong id="player-health-text">100 / 100</strong></div><div class="health-bar"><span id="player-health-bar"></span></div></div><div class="character character-player" aria-hidden="true"><span>⚡</span></div></article></div><div class="challenge-card" aria-live="polite"><div class="challenge-top"><span class="challenge-tag">DESAFIO <span id="question-number">01</span>/<?= (int) $gameConfig['rounds'] ?></span><button class="read-button" id="read-question" type="button"><span aria-hidden="true">◖</span> Ouvir conta</button></div><p class="turn-label" id="turn-label">Sua vez de atacar!</p><div class="equation" id="equation" aria-label="Quanto é 7 mais 5?">7 + 5 = ?</div><p class="helper-text">Digite a resposta ou escolha uma opção.</p><form id="answer-form" class="answer-form"><label class="visually-hidden" for="answer-input">Sua resposta</label><input id="answer-input" type="number" inputmode="numeric" autocomplete="off" placeholder="?" aria-describedby="answer-feedback" disabled><button class="attack-button" id="attack-button" type="submit" disabled><span aria-hidden="true">➤</span> Atacar</button></form><div class="choice-grid" id="choice-grid" aria-label="Opções de resposta"></div><p class="feedback" id="answer-feedback" role="status"></p></div><div class="arena-footer"><span><kbd>Enter</kbd> confirma sua resposta</span><button class="start-button" id="start-button" type="button">Começar batalha <span aria-hidden="true">→</span></button></div></section>
    <section class="how-section" aria-labelledby="how-title"><div><p class="eyebrow">COMO FUNCIONA</p><h2 id="how-title">Cada acerto deixa você mais forte.</h2></div><div class="steps"><div><span>01</span><p>Resolva a conta</p></div><div><span>02</span><p>Acerte o oponente</p></div><div><span>03</span><p>Complete a fase</p></div></div></section>
  </main>
  <footer class="footer"><img class="footer-logo" src="assets/gulf-tech-logo.svg" alt="GUILF TECH"><span>GUILF TECH</span><span><?= htmlspecialchars($gameConfig['grade'], ENT_QUOTES, 'UTF-8') ?></span></footer><div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script>window.gameConfig = <?= json_encode($gameConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;</script>
  <script src="app.js?v=73"></script>
</body>
</html>
