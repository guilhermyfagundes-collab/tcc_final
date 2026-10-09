<?php
session_start();
require __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function jsonResponse($status, $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
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
        $configuredProfessorCode = getenv('PROFESSOR_ACCESS_CODE') ?: 'professor2026';
        if ($email === '' || $password === '') {
            jsonResponse(400, ['success' => false, 'message' => 'E-mail e senha são obrigatórios.']);
        }
        if (!in_array($role, ['student', 'professor', 'admin'], true)) {
            jsonResponse(400, ['success' => false, 'message' => 'O tipo de conta é inválido.']);
        }
        if ($role === 'professor' && $professorCode !== $configuredProfessorCode) {
            jsonResponse(403, ['success' => false, 'message' => 'Código de Professor inválido.']);
        }
        if ($role === 'admin' && $password !== '12345') {
            jsonResponse(403, ['success' => false, 'message' => 'A senha de Admin deve ser 12345.']);
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            jsonResponse(409, ['success' => false, 'message' => 'Este e-mail já possui cadastro.']);
        }

        $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (:name, :email, :password, :role)');
        $stmt->execute([
            'name' => $name !== '' ? $name : 'Jogador 1',
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

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password']) || $user['role'] !== $role) {
            jsonResponse(401, ['success' => false, 'message' => 'E-mail, senha ou tipo de conta incorretos.']);
        }

        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['user_role'] = $user['role'] ?? 'student';

        $settings = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
        $settings->execute(['user_id' => (int) $user['id']]);
        $pref = $settings->fetch();

        jsonResponse(200, ['success' => true, 'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role'] ?? 'student'], 'settings' => $pref ?: ['theme' => 'light', 'memory_best' => 0]]);
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
        $name = trim((string) ($payload['name'] ?? 'Jogador 1'));
        $game = trim((string) ($payload['game'] ?? 'battle'));
        $time = max(1, (int) ($payload['time'] ?? 0));

        $stmt = $pdo->prepare('INSERT INTO ranking (user_id, game, nickname, time_seconds) VALUES (:user_id, :game, :nickname, :time_seconds)');
        $stmt->execute([
            'user_id' => isset($payload['user_id']) ? (int) $payload['user_id'] : null,
            'game' => $game,
            'nickname' => $name !== '' ? $name : 'Jogador 1',
            'time_seconds' => $time,
        ]);

        jsonResponse(201, ['success' => true, 'message' => 'Ranking salvo.']);
    }

    if ($action === 'history') {
        $userId = (int) ($_GET['user_id'] ?? $payload['user_id'] ?? 0);
        if ($userId <= 0) {
            jsonResponse(400, ['success' => false, 'message' => 'Usuário não informado.']);
        }

        $stmt = $pdo->prepare('SELECT * FROM matches WHERE user_id = :user_id ORDER BY played_at DESC LIMIT 20');
        $stmt->execute(['user_id' => $userId]);

        jsonResponse(200, ['success' => true, 'items' => $stmt->fetchAll()]);
    }

    if ($action === 'save_match') {
        $userId = isset($payload['user_id']) ? (int) $payload['user_id'] : null;
        $stmt = $pdo->prepare('INSERT INTO matches (user_id, game, won, score, difficulty, correct_answers) VALUES (:user_id, :game, :won, :score, :difficulty, :correct_answers)');
        $stmt->execute([
            'user_id' => $userId,
            'game' => trim((string) ($payload['game'] ?? 'battle')),
            'won' => (int) ($payload['won'] ?? 0),
            'score' => (int) ($payload['score'] ?? 0),
            'difficulty' => trim((string) ($payload['difficulty'] ?? 'easy')),
            'correct_answers' => (int) ($payload['correct_answers'] ?? 0),
        ]);

        jsonResponse(201, ['success' => true, 'message' => 'Partida salva.']);
    }

    if ($action === 'save_error') {
        $userId = (int) ($payload['user_id'] ?? 0);
        $studentName = trim((string) ($payload['student_name'] ?? 'Jogador 1'));
        $question = trim((string) ($payload['question'] ?? ''));
        $studentAnswer = trim((string) ($payload['student_answer'] ?? ''));
        $correctAnswer = trim((string) ($payload['correct_answer'] ?? ''));
        $difficulty = trim((string) ($payload['difficulty'] ?? 'easy'));
        if ($userId <= 0 || $question === '' || $correctAnswer === '') {
            jsonResponse(400, ['success' => false, 'message' => 'Dados do erro inválidos.']);
        }
        $stmt = $pdo->prepare('INSERT INTO errors (user_id, student_name, question, student_answer, correct_answer, difficulty, status) VALUES (:user_id, :student_name, :question, :student_answer, :correct_answer, :difficulty, "open")');
        $stmt->execute([
            'user_id' => $userId,
            'student_name' => $studentName,
            'question' => $question,
            'student_answer' => $studentAnswer,
            'correct_answer' => $correctAnswer,
            'difficulty' => $difficulty,
        ]);
        jsonResponse(201, ['success' => true, 'message' => 'Erro registrado.']);
    }

    if ($action === 'settings') {
        $userId = (int) ($_GET['user_id'] ?? $payload['user_id'] ?? 0);
        if ($userId <= 0) {
            jsonResponse(400, ['success' => false, 'message' => 'Usuário não informado.']);
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $theme = trim((string) ($payload['theme'] ?? 'light'));
            $memoryBest = max(0, (int) ($payload['memory_best'] ?? 0));

            $stmt = $pdo->prepare('INSERT INTO user_settings (user_id, theme, memory_best) VALUES (:user_id, :theme, :memory_best) ON DUPLICATE KEY UPDATE theme = VALUES(theme), memory_best = GREATEST(memory_best, VALUES(memory_best))');
            $stmt->execute([
                'user_id' => $userId,
                'theme' => $theme === 'dark' ? 'dark' : 'light',
                'memory_best' => $memoryBest,
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
    jsonResponse(500, ['success' => false, 'message' => 'Erro no banco de dados: ' . $exception->getMessage()]);
}
