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
- Os controles flutuantes permitem ampliar ou reduzir a tela (100% a 150%) e entrar em tela cheia.
- O widget oficial VLibras pode traduzir conteúdos do site para Língua Brasileira de Sinais; requer conexão com a internet para carregar.
- Cadastro e login dependem do PHP e do MySQL; a sessão é mantida pelo cookie seguro da sessão PHP.
- A tela de boas-vindas é a primeira experiência para visitantes; é necessário entrar ou criar uma conta para acessar os jogos. O formulário de senha permite mostrar ou ocultar o que foi digitado.
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

## Publicar na InfinityFree

O arquivo `conta-combate-infinityfree.zip` contém os arquivos necessários para a hospedagem. Extraia o ZIP e envie o conteúdo da pasta para `htdocs` pelo gerenciador de arquivos ou FTP; `index.php` deve ficar diretamente dentro de `htdocs`, não em uma subpasta.

1. No painel da InfinityFree, crie um banco MySQL e anote o nome do host, o nome do banco, o usuário e a senha exibidos no painel.
2. Selecione esse banco no phpMyAdmin e importe `database/conta_combate.sql` que está dentro do ZIP. Esse arquivo não cria banco nem seleciona um nome local.
3. Edite `config/db.php` no servidor e substitua os valores padrão de host, porta (`3306`), banco, usuário e senha pelas informações do painel da InfinityFree.
4. Acesse o domínio para testar cadastro, login e jogos. O cadastro de professor fica desabilitado até configurar `PROFESSOR_ACCESS_CODE` no servidor; não use um código público.

O ZIP não inclui `.git`, arquivos de resposta locais, o iniciador do Laragon nem o script de migração manual. Mantenha uma cópia local do projeto e não publique credenciais do banco.
