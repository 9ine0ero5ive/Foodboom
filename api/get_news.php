<?php
header('Content-Type: application/json');
$file = __DIR__ . '/data/news.json';
echo file_exists($file) ? file_get_contents($file) : json_encode([]);