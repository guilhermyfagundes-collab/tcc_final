<?php
require __DIR__ . '/../config/db.php';

$pdo = dbConnect();
$columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_ASSOC);
$hasRole = false;
foreach ($columns as $column) {
    if ($column['Field'] === 'role') {
        $hasRole = true;
        break;
    }
}

if (!$hasRole) {
    $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student' AFTER password");
    echo "role column added\n";
} else {
    echo "role column already exists\n";
}
