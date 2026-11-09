<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$file = __DIR__ . '/data/orders.json';

if (file_exists($file) && isset($data['id'])) {
    $orders = json_decode(file_get_contents($file), true);
    $orders = array_values(array_filter($orders, fn($o) => $o['id'] !== $data['id']));
    file_put_contents($file, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}