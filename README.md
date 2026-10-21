# Conta & Combate

Plataforma de aprendizagem de Matemática para o Ensino Fundamental II. Mantém os dois jogos existentes — **Conta & Combate** e **Memória dos Números** — com níveis de dificuldade, acompanhamento de progresso e histórico vinculado à conta do aluno.

## Experiência de jogo

- Escolha entre três níveis antes de iniciar a batalha.
- Responda pelo teclado ou pelas opções na tela; a partida pode ser pausada.
- Use itens durante a batalha e pratique sem pressão no modo treino.
- O treino não registra tempos no ranking competitivo.
- A rodada atual, a energia e o resultado são atualizados durante a partida.
- A Memória dos Números trabalha a associação de cartas com números iguais, com níveis de 4, 6 e 8 pares.
- O painel do aluno apresenta partidas, acertos, erros para revisar, vitórias, progresso por jogo e conquistas.
- Os controles flutuantes permitem ampliar ou reduzir a tela (100% a 150%), ativar contraste/redução de animações e entrar em tela cheia.
- O widget oficial VLibras pode traduzir conteúdos do site para Língua Brasileira de Sinais; requer conexão com a internet para carregar.
- Cadastro e login dependem do PHP e do MySQL; a sessão é mantida pelo cookie seguro da sessão PHP.
- O perfil permite alterar o nome e, com confirmação da senha atual, cadastrar uma nova senha.

## Estrutura

- `index.php`: entrada da aplicacao e interface principal.
- `config/game.php`: configuracoes do jogo.
- `app.js`: regras da batalha e acessibilidade interativa.
- `styles.css`: identidade visual e responsividade.
- `difficulty.css` e `effects.css`: níveis de dificuldade e efeitos da batalha.

## Dados e banco de dados

A API em `api/index.php` persiste contas, preferências, partidas, erros, ranking, progresso e conquistas no MySQL configurado em `config/db.php`. Importe `database/conta_combate.sql` para criar as tabelas; em uma instalação existente, importe-o novamente para criar as tabelas novas sem apagar os dados das tabelas existentes. O VLibras é carregado do domínio oficial `vlibras.gov.br` e não é necessário para login, jogos ou persistência.

O cadastro público cria contas de aluno. Para habilitar cadastro de professor, defina a variável de ambiente `PROFESSOR_ACCESS_CODE` no PHP/Apache com um código não público. Contas administrativas não são criadas pelo formulário público; devem ser provisionadas por um responsável diretamente no banco, atribuindo o papel `admin`. Use senhas fortes e não publique o código de professor.

A recuperação automática de senha não está configurada: a tela orienta o aluno a procurar um professor ou administrador. A sessão e os dados de partidas do painel exigem conexão ativa com a API e o banco de dados.

## Executar no Laragon

1. Mantenha a pasta em `laragon/www/tcc_final`.
2. Inicie Apache e MySQL no Laragon.
3. Importe `database/conta_combate.sql` pelo phpMyAdmin ou cliente MySQL.
4. Confira as credenciais do banco em `config/db.php`.
5. Abra `http://localhost/tcc_final/`.

Opção rápida: execute `iniciar-jogo.bat` dentro desta pasta. Ele abre o site no Apache pelo endereço `http://localhost/tcc_final/`.
