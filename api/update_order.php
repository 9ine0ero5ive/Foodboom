<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$file = __DIR__ . '/data/orders.json';

if (file_exists($file) && isset($data['id']) && isset($data['status'])) {
    $orders = json_decode(file_get_contents($file), true);
    foreach ($orders as &$order) {
        if ($order['id'] === $data['id']) {
            $order['status'] = $data['status'];
            break;
        }
    }
    file_put_contents($file, json_encode($orders, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}