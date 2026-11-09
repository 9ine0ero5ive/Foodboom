<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$file = __DIR__ . '/data/requests.json';

if (file_exists($file) && isset($data['id'])) {
    $requests = json_decode(file_get_contents($file), true);
    foreach ($requests as &$r) {
        if ($r['id'] === $data['id']) {
            $r['status'] = $data['status'];
            break;
        }
    }
    file_put_contents($file, json_encode($requests, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
}