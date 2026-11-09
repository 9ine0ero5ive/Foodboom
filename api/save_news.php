<?php
header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) { echo json_encode(['success' => false]); exit; }

$file = __DIR__ . '/data/news.json';
$news = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
if (!is_array($news)) $news = [];

$data['id'] = uniqid('news_');
$data['date'] = date('Y-m-d H:i:s');

array_unshift($news, $data);
file_put_contents($file, json_encode($news, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo json_encode(['success' => true]);