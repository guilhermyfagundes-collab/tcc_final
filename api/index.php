<?php
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
]);
session_start();
require __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');
function jsonResponse($status, $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function authenticatedUser(PDO $pdo): array
{
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonResponse(401, ['success' => false, 'message' => 'Faça login para continuar.']);
    }

    $stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        $_SESSION = [];
        session_destroy();
        jsonResponse(401, ['success' => false, 'message' => 'Sua sessão expirou. Entre novamente.']);
    }
    return $user;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

try {
    $pdo = dbConnect();
    $action = $_GET['action'] ?? ($_POST['action'] ?? null);
    $payload = in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'], true) ? readJsonBody() : $_GET;

    if ($action === 'register') {
        $name = trim((string) ($payload['name'] ?? 'Jogador 1'));
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        $role = trim((string) ($payload['role'] ?? 'student'));
        $professorCode = trim((string) ($payload['professor_code'] ?? ''));
        $configuredProfessorCode = getenv('PROFESSOR_ACCESS_CODE') ?: '';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || $name === '' || mb_strlen($name) > 50) {
            jsonResponse(400, ['success' => false, 'message' => 'Informe nome, e-mail válido e senha.']);
        }
        if (strlen($password) < 8) {
            jsonResponse(400, ['success' => false, 'message' => 'A senha deve ter pelo menos 8 caracteres.']);
        }
        if (!in_array($role, ['student', 'professor'], true)) {
            jsonResponse(400, ['success' => false, 'message' => 'O tipo de conta é inválido.']);
        }
        if ($role === 'professor' && ($configuredProfessorCode === '' || !hash_equals($configuredProfessorCode, $professorCode))) {
            jsonResponse(403, ['success' => false, 'message' => 'Código de Professor inválido.']);
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            jsonResponse(409, ['success' => false, 'message' => 'Este e-mail já possui cadastro.']);
        }

        $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (:name, :email, :password, :role)');
        $stmt->execute([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
        ]);

        $userId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO user_settings (user_id, theme, memory_best) VALUES (:user_id, "light", 0)')->execute(['user_id' => $userId]);

        jsonResponse(201, ['success' => true, 'message' => 'Cadastro criado com sucesso.', 'user' => ['id' => $userId, 'name' => $name, 'email' => $email, 'role' => $role]]);
    }

    if ($action === 'login') {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        $role = trim((string) ($payload['role'] ?? 'student'));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            jsonResponse(400, ['success' => false, 'message' => 'Informe e-mail e senha.']);
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password']) || $user['role'] !== $role) {
            jsonResponse(401, ['success' => false, 'message' => 'E-mail, senha ou tipo de conta incorretos.']);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['user_role'] = $user['role'] ?? 'student';

        $settings = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
        $settings->execute(['user_id' => (int) $user['id']]);
        $pref = $settings->fetch();

        jsonResponse(200, ['success' => true, 'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role'] ?? 'student'], 'settings' => $pref ?: ['theme' => 'light', 'memory_best' => 0]]);
    }

    if ($action === 'session') {
        $userId = (int) ($_SESSION['user_id'] ?? 0);
        if ($userId <= 0) {
            jsonResponse(200, ['success' => true, 'authenticated' => false]);
        }
        $user = authenticatedUser($pdo);
        $settingsStmt = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
        $settingsStmt->execute(['user_id' => $user['id']]);
        jsonResponse(200, ['success' => true, 'authenticated' => true, 'user' => $user, 'settings' => $settingsStmt->fetch() ?: ['theme' => 'light', 'memory_best' => 0]]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        jsonResponse(200, ['success' => true]);
    }

    if ($action === 'profile') {
        $user = authenticatedUser($pdo);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(405, ['success' => false, 'message' => 'Método não permitido.']);
        }

        $name = trim((string) ($payload['name'] ?? ''));
        $currentPassword = (string) ($payload['current_password'] ?? '');
        $newPassword = (string) ($payload['new_password'] ?? '');
        if ($name === '' || mb_strlen($name) > 50) {
            jsonResponse(400, ['success' => false, 'message' => 'Informe um nome com até 50 caracteres.']);
        }

        if ($newPassword !== '') {
            if (strlen($newPassword) < 8) {
                jsonResponse(400, ['success' => false, 'message' => 'A nova senha deve ter pelo menos 8 caracteres.']);
            }
            $passwordStmt = $pdo->prepare('SELECT password FROM users WHERE id = :id');
            $passwordStmt->execute(['id' => $user['id']]);
            $storedPassword = $passwordStmt->fetchColumn();
            if (!$currentPassword || !password_verify($currentPassword, (string) $storedPassword)) {
                jsonResponse(403, ['success' => false, 'message' => 'A senha atual está incorreta.']);
            }
            $stmt = $pdo->prepare('UPDATE users SET name = :name, password = :password WHERE id = :id');
            $stmt->execute(['name' => $name, 'password' => password_hash($newPassword, PASSWORD_DEFAULT), 'id' => $user['id']]);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET name = :name WHERE id = :id');
            $stmt->execute(['name' => $name, 'id' => $user['id']]);
        }

        jsonResponse(200, ['success' => true, 'user' => ['id' => (int) $user['id'], 'name' => $name, 'email' => $user['email'], 'role' => $user['role']]]);
    }

    if ($action === 'errors') {
        $search = trim((string) ($_GET['search'] ?? $payload['search'] ?? ''));
        $sessionUserId = (int) ($_SESSION['user_id'] ?? 0);
        $sessionRole = $_SESSION['user_role'] ?? 'student';
        if ($sessionUserId <= 0 || !in_array($sessionRole, ['professor', 'admin'], true)) {
            jsonResponse(403, ['success' => false, 'message' => 'Acesso restrito a Professores ou Admins.']);
        }

        $searchPattern = $search === '' ? '%' : '%' . $search . '%';
        $stmt = $pdo->prepare('SELECT id, student_name, question, student_answer, correct_answer, difficulty, status, note, created_at FROM errors WHERE student_name LIKE :search OR question LIKE :search OR student_answer LIKE :search ORDER BY created_at DESC');
        $stmt->execute(['search' => $searchPattern]);
        jsonResponse(200, ['success' => true, 'items' => $stmt->fetchAll()]);
    }

    if ($action === 'error_update') {
        $id = (int) ($_GET['id'] ?? $payload['id'] ?? 0);
        $status = trim((string) ($_GET['status'] ?? $payload['status'] ?? 'open'));
        $note = trim((string) ($_GET['note'] ?? $payload['note'] ?? ''));
        $sessionUserId = (int) ($_SESSION['user_id'] ?? 0);
        $sessionRole = $_SESSION['user_role'] ?? 'student';
        if ($id <= 0 || $sessionUserId <= 0 || !in_array($sessionRole, ['professor', 'admin'], true) || !in_array($status, ['open', 'fixed', 'closed'], true)) {
            jsonResponse(400, ['success' => false, 'message' => 'Dados inválidos ou acesso restrito.']);
        }
        $stmt = $pdo->prepare('UPDATE errors SET status = :status, note = :note, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->execute(['status' => $status, 'note' => $note, 'id' => $id]);
        jsonResponse(200, ['success' => true, 'message' => 'Erro atualizado.']);
    }

    if ($action === 'error_delete') {
        $id = (int) ($_GET['id'] ?? $payload['id'] ?? 0);
        $sessionUserId = (int) ($_SESSION['user_id'] ?? 0);
        $sessionRole = $_SESSION['user_role'] ?? 'student';
        if ($id <= 0 || $sessionUserId <= 0 || !in_array($sessionRole, ['professor', 'admin'], true)) {
            jsonResponse(403, ['success' => false, 'message' => 'Acesso restrito a Professores ou Admins.']);
        }
        $stmt = $pdo->prepare('DELETE FROM errors WHERE id = :id');
        $stmt->execute(['id' => $id]);
        jsonResponse(200, ['success' => true, 'message' => 'Erro removido.']);
    }

    if ($action === 'questions') {
        $sessionUserId = (int) ($_SESSION['user_id'] ?? 0);
        $sessionRole = $_SESSION['user_role'] ?? 'student';
        if ($sessionUserId <= 0) {
            jsonResponse(403, ['success' => false, 'message' => 'Você precisa estar autenticado.']);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $difficulty = trim((string) ($_GET['difficulty'] ?? $payload['difficulty'] ?? ''));
            $sql = $difficulty === '' ? 'SELECT id, difficulty, question, answer FROM questions ORDER BY updated_at DESC' : 'SELECT id, difficulty, question, answer FROM questions WHERE difficulty = :difficulty ORDER BY updated_at DESC';
            $stmt = $pdo->prepare($sql);
            if ($difficulty !== '') $stmt->bindValue(':difficulty', $difficulty);
            $stmt->execute();
            jsonResponse(200, ['success' => true, 'items' => $stmt->fetchAll()]);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && $sessionRole === 'admin') {
            $id = (int) ($payload['id'] ?? 0);
            $difficulty = trim((string) ($payload['difficulty'] ?? ''));
            $question = trim((string) ($payload['question'] ?? ''));
            $answer = trim((string) ($payload['answer'] ?? ''));
            if (!in_array($difficulty, ['easy', 'medium', 'hard'], true) || $question === '' || $answer === '') {
                jsonResponse(400, ['success' => false, 'message' => 'Dificuldade, pergunta e resposta são obrigatórios.']);
            }
            if ($id > 0) {
                $stmt = $pdo->prepare('UPDATE questions SET difficulty = :difficulty, question = :question, answer = :answer WHERE id = :id');
                $stmt->execute(['difficulty' => $difficulty, 'question' => $question, 'answer' => $answer, 'id' => $id]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO questions (difficulty, question, answer) VALUES (:difficulty, :question, :answer)');
                $stmt->execute(['difficulty' => $difficulty, 'question' => $question, 'answer' => $answer]);
            }
            jsonResponse(200, ['success' => true, 'message' => $id > 0 ? 'Pergunta atualizada.' : 'Pergunta criada.']);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && $sessionRole === 'admin') {
            $id = (int) ($_GET['id'] ?? $payload['id'] ?? 0);
            if ($id <= 0) jsonResponse(400, ['success' => false, 'message' => 'ID da pergunta inválido.']);
            $stmt = $pdo->prepare('DELETE FROM questions WHERE id = :id');
            $stmt->execute(['id' => $id]);
            jsonResponse(200, ['success' => true, 'message' => 'Pergunta excluída.']);
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            jsonResponse(403, ['success' => false, 'message' => 'Acesso restrito ao Admin.']);
        }
    }

    if ($action === 'ranking') {
        $game = trim((string) ($_GET['game'] ?? $payload['game'] ?? 'battle'));
        $limit = max(1, min(20, (int) ($_GET['limit'] ?? $payload['limit'] ?? 10)));

        $stmt = $pdo->prepare('SELECT nickname, time_seconds AS time, game FROM ranking WHERE game = :game ORDER BY time_seconds ASC, created_at ASC LIMIT :limit');
        $stmt->bindValue(':game', $game, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        jsonResponse(200, ['success' => true, 'items' => $stmt->fetchAll()]);
    }

    if ($action === 'save_ranking') {
        $user = authenticatedUser($pdo);
        $game = trim((string) ($payload['game'] ?? 'battle'));
        $time = max(1, (int) ($payload['time'] ?? 0));
        if (!in_array($game, ['memory', 'battle-easy', 'battle-medium', 'battle-hard'], true)) {
            jsonResponse(400, ['success' => false, 'message' => 'Jogo inválido para o ranking.']);
        }

        $stmt = $pdo->prepare('INSERT INTO ranking (user_id, game, nickname, time_seconds) VALUES (:user_id, :game, :nickname, :time_seconds)');
        $stmt->execute([
            'user_id' => $user['id'],
            'game' => $game,
            'nickname' => $user['name'],
            'time_seconds' => $time,
        ]);

        jsonResponse(201, ['success' => true, 'message' => 'Ranking salvo.']);
    }

    if ($action === 'history') {
        $user = authenticatedUser($pdo);

        $stmt = $pdo->prepare('SELECT * FROM matches WHERE user_id = :user_id ORDER BY played_at DESC LIMIT 20');
        $stmt->execute(['user_id' => $user['id']]);

        jsonResponse(200, ['success' => true, 'items' => $stmt->fetchAll()]);
    }

    if ($action === 'dashboard') {
        $user = authenticatedUser($pdo);
        $userId = (int) $user['id'];
        $statsStmt = $pdo->prepare('SELECT COUNT(*) AS games_played, COALESCE(SUM(won), 0) AS wins, COALESCE(SUM(correct_answers), 0) AS correct_answers, COALESCE(MAX(score), 0) AS best_score FROM matches WHERE user_id = :user_id');
        $statsStmt->execute(['user_id' => $userId]);
        $stats = $statsStmt->fetch() ?: [];
        $errorsStmt = $pdo->prepare('SELECT COUNT(*) FROM errors WHERE user_id = :user_id');
        $errorsStmt->execute(['user_id' => $userId]);
        $recentErrorsStmt = $pdo->prepare('SELECT question, student_answer, correct_answer, difficulty, created_at FROM errors WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 5');
        $recentErrorsStmt->execute(['user_id' => $userId]);
        $recentStmt = $pdo->prepare('SELECT game, won, score, difficulty, correct_answers, played_at FROM matches WHERE user_id = :user_id ORDER BY played_at DESC LIMIT 8');
        $recentStmt->execute(['user_id' => $userId]);
        $achievementStmt = $pdo->prepare('SELECT achievement_key, title, description, unlocked_at FROM achievements WHERE user_id = :user_id ORDER BY unlocked_at DESC');
        $achievementStmt->execute(['user_id' => $userId]);
        $progressStmt = $pdo->prepare('SELECT game, level FROM user_progress WHERE user_id = :user_id');
        $progressStmt->execute(['user_id' => $userId]);

        jsonResponse(200, [
            'success' => true,
            'stats' => [
                'games_played' => (int) ($stats['games_played'] ?? 0),
                'wins' => (int) ($stats['wins'] ?? 0),
                'correct_answers' => (int) ($stats['correct_answers'] ?? 0),
                'errors' => (int) $errorsStmt->fetchColumn(),
                'best_score' => (int) ($stats['best_score'] ?? 0),
            ],
            'matches' => $recentStmt->fetchAll(),
            'recent_errors' => $recentErrorsStmt->fetchAll(),
            'achievements' => $achievementStmt->fetchAll(),
            'progress' => $progressStmt->fetchAll(),
        ]);
    }

    if ($action === 'save_match') {
        $user = authenticatedUser($pdo);
        $game = trim((string) ($payload['game'] ?? ''));
        $difficulty = trim((string) ($payload['difficulty'] ?? ''));
        $won = filter_var($payload['won'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $score = (int) ($payload['score'] ?? -1);
        $correctAnswers = (int) ($payload['correct_answers'] ?? -1);
        if (!in_array($game, ['battle', 'memory'], true) || !in_array($difficulty, ['easy', 'medium', 'hard'], true) || $score < 0 || $correctAnswers < 0 || $correctAnswers > 1000) {
            jsonResponse(400, ['success' => false, 'message' => 'Resultado de partida inválido.']);
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO matches (user_id, game, won, score, difficulty, correct_answers) VALUES (:user_id, :game, :won, :score, :difficulty, :correct_answers)');
        $stmt->execute([
            'user_id' => $user['id'],
            'game' => $game,
            'won' => $won ? 1 : 0,
            'score' => $score,
            'difficulty' => $difficulty,
            'correct_answers' => $correctAnswers,
        ]);

        $level = ['easy' => 1, 'medium' => 2, 'hard' => 3][$difficulty];
        $progressStmt = $pdo->prepare('INSERT INTO user_progress (user_id, game, level) VALUES (:user_id, :game, :level) ON DUPLICATE KEY UPDATE level = GREATEST(level, VALUES(level))');
        $progressStmt->execute(['user_id' => $user['id'], 'game' => $game, 'level' => $won ? $level : 0]);

        $awardStmt = $pdo->prepare('INSERT IGNORE INTO achievements (user_id, achievement_key, title, description) VALUES (:user_id, :achievement_key, :title, :description)');
        $award = static function (string $key, string $title, string $description) use ($awardStmt, $user): void {
            $awardStmt->execute(['user_id' => $user['id'], 'achievement_key' => $key, 'title' => $title, 'description' => $description]);
        };
        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM matches WHERE user_id = :user_id');
        $countStmt->execute(['user_id' => $user['id']]);
        if ((int) $countStmt->fetchColumn() === 1) {
            $award('first-match', 'Primeira missão', 'Você concluiu sua primeira partida.');
        }
        if ($won) {
            $award('first-victory', 'Primeira vitória', 'Você venceu sua primeira partida.');
        }
        if ($game === 'memory' && $won) {
            $award('memory-master', 'Memória afiada', 'Você encontrou todos os pares no jogo da memória.');
        }
        $winsStmt = $pdo->prepare('SELECT COUNT(*) FROM matches WHERE user_id = :user_id AND won = 1');
        $winsStmt->execute(['user_id' => $user['id']]);
        if ((int) $winsStmt->fetchColumn() >= 5) {
            $award('five-victories', 'Persistência', 'Você conquistou cinco vitórias.');
        }
        $pdo->commit();
        jsonResponse(201, ['success' => true, 'message' => 'Partida salva.']);
    }

    if ($action === 'save_error') {
        $user = authenticatedUser($pdo);
        $question = trim((string) ($payload['question'] ?? ''));
        $studentAnswer = trim((string) ($payload['student_answer'] ?? ''));
        $correctAnswer = trim((string) ($payload['correct_answer'] ?? ''));
        $difficulty = trim((string) ($payload['difficulty'] ?? 'easy'));
        if ($question === '' || strlen($question) > 120 || $correctAnswer === '' || !in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            jsonResponse(400, ['success' => false, 'message' => 'Dados do erro inválidos.']);
        }
        $stmt = $pdo->prepare('INSERT INTO errors (user_id, student_name, question, student_answer, correct_answer, difficulty, status) VALUES (:user_id, :student_name, :question, :student_answer, :correct_answer, :difficulty, "open")');
        $stmt->execute([
            'user_id' => $user['id'],
            'student_name' => $user['name'],
            'question' => $question,
            'student_answer' => $studentAnswer,
            'correct_answer' => $correctAnswer,
            'difficulty' => $difficulty,
        ]);
        jsonResponse(201, ['success' => true, 'message' => 'Erro registrado.']);
    }

    if ($action === 'settings') {
        $user = authenticatedUser($pdo);
        $userId = (int) $user['id'];

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $currentStmt = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
            $currentStmt->execute(['user_id' => $userId]);
            $currentSettings = $currentStmt->fetch() ?: ['theme' => 'light', 'memory_best' => 0];
            $theme = array_key_exists('theme', $payload) ? trim((string) $payload['theme']) : $currentSettings['theme'];
            $memoryBest = max(0, (int) ($payload['memory_best'] ?? 0));

            $stmt = $pdo->prepare('INSERT INTO user_settings (user_id, theme, memory_best) VALUES (:user_id, :theme, :memory_best) ON DUPLICATE KEY UPDATE theme = VALUES(theme), memory_best = GREATEST(memory_best, VALUES(memory_best))');
            $stmt->execute([
                'user_id' => $userId,
                'theme' => $theme === 'dark' ? 'dark' : 'light',
                'memory_best' => max($memoryBest, (int) $currentSettings['memory_best']),
            ]);

            jsonResponse(200, ['success' => true, 'message' => 'Configuração salva.']);
        }

        $stmt = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $settings = $stmt->fetch();

        jsonResponse(200, ['success' => true, 'settings' => $settings ?: ['theme' => 'light', 'memory_best' => 0]]);
    }

    jsonResponse(400, ['success' => false, 'message' => 'Ação inválida.']);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log($exception->getMessage());
    jsonResponse(500, ['success' => false, 'message' => 'Não foi possível concluir a operação. Tente novamente.']);
}
