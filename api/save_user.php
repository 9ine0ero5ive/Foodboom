<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) { echo json_encode(['success' => false, 'error' => 'No data']); exit; }

$file = __DIR__ . '/data/users.json';
$users = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
if (!is_array($users)) $users = [];

foreach ($users as $u) {
    if (($u['email'] ?? '') === $data['email']) {
        echo json_encode(['success' => false, 'error' => 'Этот email уже зарегистрирован']); exit;
    }
}

$data['id'] = 'u_' . uniqid();
$data['createdAt'] = date('Y-m-d H:i:s');
if (!isset($data['role'])) $data['role'] = 'user';

$users[] = $data;
file_put_contents($file, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

echo json_encode(['success' => true, 'user' => $data]);