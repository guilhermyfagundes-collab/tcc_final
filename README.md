# Conta & Combate

Jogo de matematica para o 2o ano do Ensino Fundamental, com batalhas de contas de adicao e subtracao.

## Estrutura

- `index.php`: entrada da aplicacao e interface principal.
- `config/game.php`: configuracoes do jogo.
- `app.js`: regras da batalha e acessibilidade interativa.
- `styles.css`: identidade visual e responsividade.
- `difficulty.css` e `effects.css`: níveis de dificuldade e efeitos da batalha.

## Banco de dados

Este jogo não usa banco de dados. O nick, a energia e o progresso existem apenas durante a partida no navegador; nenhum dado é salvo dentro do VS Code ou da pasta do projeto.

## Executar no Laragon

1. Mantenha a pasta em `laragon/www/tcc_final`.
2. Inicie o Apache no Laragon.
3. Abra `http://localhost/tcc_final/`.

Opcao rapida: execute `iniciar-jogo.bat` dentro desta pasta. Ele abre o jogo no Apache pelo endereco `http://localhost/tcc_final/`.
