<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$file = __DIR__ . '/data/users.json';

if (file_exists($file) && isset($data['id'])) {
    $users = json_decode(file_get_contents($file), true);
    $users = array_values(array_filter($users, fn($u) => $u['id'] !== $data['id']));
    file_put_contents($file, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}