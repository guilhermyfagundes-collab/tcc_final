<?php
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
    $payload = $_SERVER['REQUEST_METHOD'] === 'POST' ? readJsonBody() : $_GET;

    if ($action === 'register') {
        $name = trim((string) ($payload['name'] ?? 'Jogador 1'));
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || $password === '') {
            jsonResponse(400, ['success' => false, 'message' => 'E-mail e senha são obrigatórios.']);
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $exists->execute(['email' => $email]);
        if ($exists->fetch()) {
            jsonResponse(409, ['success' => false, 'message' => 'Este e-mail já possui cadastro.']);
        }

        $stmt = $pdo->prepare('INSERT INTO users (name, email, password) VALUES (:name, :email, :password)');
        $stmt->execute([
            'name' => $name !== '' ? $name : 'Jogador 1',
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        $userId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO user_settings (user_id, theme, memory_best) VALUES (:user_id, "light", 0)')->execute(['user_id' => $userId]);

        jsonResponse(201, ['success' => true, 'message' => 'Cadastro criado com sucesso.', 'user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
    }

    if ($action === 'login') {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonResponse(401, ['success' => false, 'message' => 'E-mail ou senha incorretos.']);
        }

        $settings = $pdo->prepare('SELECT theme, memory_best FROM user_settings WHERE user_id = :user_id LIMIT 1');
        $settings->execute(['user_id' => (int) $user['id']]);
        $pref = $settings->fetch();

        jsonResponse(200, ['success' => true, 'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email']], 'settings' => $pref ?: ['theme' => 'light', 'memory_best' => 0]]);
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
