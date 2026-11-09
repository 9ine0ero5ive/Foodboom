<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) { echo json_encode(['success' => false]); exit; }

$file = __DIR__ . '/data/requests.json';
$requests = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
if (!is_array($requests)) $requests = [];

$data['id'] = uniqid('req_');
$data['date'] = date('Y-m-d H:i:s');
$data['status'] = 'new';

array_unshift($requests, $data);
file_put_contents($file, json_encode($requests, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode(['success' => true]);