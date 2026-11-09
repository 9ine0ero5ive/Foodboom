<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
$file = __DIR__ . '/data/news.json';

if (file_exists($file) && isset($data['id'])) {
    $news = json_decode(file_get_contents($file), true);
    $news = array_values(array_filter($news, fn($n) => $n['id'] !== $data['id']));
    file_put_contents($file, json_encode($news, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
}