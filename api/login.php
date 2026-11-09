<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) { echo json_encode(['success' => false]); exit; }

$file = __DIR__ . '/data/users.json';
if (!file_exists($file)) { echo json_encode(['success' => false, 'error' => 'Нет пользователей']); exit; }

$users = json_decode(file_get_contents($file), true);
$isEmail = filter_var($data['identifier'], FILTER_VALIDATE_EMAIL);
$idDigits = preg_replace('/\D/', '', $data['identifier']);

foreach ($users as $user) {
    $match = $isEmail ? (($user['email'] ?? '') === strtolower($data['identifier'])) : (($user['phoneDigits'] ?? '') === $idDigits);
    if ($match) {
        if ($user['passwordHash'] === $data['passwordHash']) {
            echo json_encode(['success' => true, 'user' => $user]); exit;
        } else {
            echo json_encode(['success' => false, 'error' => 'Неверный пароль']); exit;
        }
    }
}
echo json_encode(['success' => false, 'error' => 'Пользователь не найден']);