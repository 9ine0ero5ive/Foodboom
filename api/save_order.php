<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) { echo json_encode(['success' => false]); exit; }

$file = __DIR__ . '/data/orders.json';
$orders = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

// Добавляем новый заказ в начало
array_unshift($orders, $data);
file_put_contents($file, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);