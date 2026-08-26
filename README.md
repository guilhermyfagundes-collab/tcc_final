# Conta & Combate

Jogo de matematica para o 2o ano do Ensino Fundamental, com batalhas de contas de adicao e subtracao.

## Estrutura

- `index.php`: entrada da aplicacao e interface principal.
- `config/game.php`: configuracoes do jogo.
- `app.js`: regras da batalha e acessibilidade interativa.
- `styles.css`: identidade visual e responsividade.

## Executar no Laragon

1. Mantenha a pasta em `laragon/www/tcc_final`.
2. Inicie o Apache no Laragon.
3. Abra `http://localhost/tcc_final/`.

Opcao rapida: execute `iniciar-jogo.bat` dentro desta pasta. Ele encontra o PHP do Laragon, inicia um servidor local e abre o jogo no navegador.

Importante: a porta 80 deste computador esta sendo usada pelo Apache do XAMPP. Por isso, `http://localhost/tcc_final/` retorna 404. Use o inicializador ou abra `http://127.0.0.1:8088/`.

Tambem e possivel testar com PHP embutido:

```powershell
php -S localhost:8088 -t .
```

Depois abra `http://localhost:8088/`.
