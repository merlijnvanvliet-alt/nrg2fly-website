<?php
// ===== NRG2fly Lead capture — Energy Scan =====
// Receives a JSON POST from /energy-scan, validates it, and e-mails the team.

define('NOTIFY_EMAIL', 'merlijn@nrg2fly.com');
define('FROM_EMAIL',   'noreply@nrg2fly.com');
define('FROM_NAME',    'NRG2fly Energy Scan');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Sanitise helpers
function s($v) { return htmlspecialchars(trim((string)($v ?? '')), ENT_QUOTES, 'UTF-8'); }

$airport = s($data['airport'] ?? '');
$name    = s($data['name']    ?? '');
$role    = s($data['role']    ?? '');
$email   = filter_var(trim($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$phone   = s($data['phone']   ?? '');

if (!$airport || !$name || !$email) {
    http_response_code(422);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// Answers
$answers = $data['answers'] ?? [];
$grid    = s($answers['grid']    ?? '—');
$assets  = is_array($answers['assets'] ?? null) ? implode(', ', array_map('s', $answers['assets'])) : '—';
$parties = s($answers['parties'] ?? '—');
$flex    = s($answers['flex']    ?? '—');

// Top result
$scores  = $data['scores'] ?? [];
$top     = '';
if (is_array($scores) && count($scores) > 0) {
    $first = $scores[0];
    $top   = s($first['key'] ?? '') . ' (score: ' . intval($first['score'] ?? 0) . ')';
}

// Build e-mail
$subject = 'Nieuwe Energy Scan lead: ' . $airport;

$body  = "Nieuwe inzending via de NRG2fly Energy Scan\n";
$body .= str_repeat('─', 50) . "\n\n";
$body .= "Luchthaven : {$airport}\n";
$body .= "Contactpersoon : {$name}" . ($role ? " ({$role})" : '') . "\n";
$body .= "E-mail     : {$email}\n";
$body .= "Telefoon   : " . ($phone ?: '—') . "\n\n";
$body .= str_repeat('─', 50) . "\n";
$body .= "ANTWOORDEN\n";
$body .= str_repeat('─', 50) . "\n";
$body .= "Netaansluiting : {$grid}\n";
$body .= "Installaties   : {$assets}\n";
$body .= "Partijen       : {$parties}\n";
$body .= "Flexibiliteit  : {$flex}\n\n";
$body .= "Aanbevolen strategie: {$top}\n\n";
$body .= str_repeat('─', 50) . "\n";
$body .= "Verzonden op: " . date('Y-m-d H:i:s') . "\n";

$headers  = "From: " . FROM_NAME . " <" . FROM_EMAIL . ">\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail(NOTIFY_EMAIL, $subject, $body, $headers);

// Optional: append to a local log (CSV)
$logFile = __DIR__ . '/leads-log.csv';
$line    = implode(',', [
    date('c'),
    '"' . str_replace('"', '""', $airport) . '"',
    '"' . str_replace('"', '""', $name) . '"',
    '"' . str_replace('"', '""', $email) . '"',
    '"' . $grid . '"',
    '"' . $assets . '"',
    '"' . $parties . '"',
    '"' . $flex . '"',
    '"' . $top . '"',
]) . "\n";

if (!file_exists($logFile)) {
    file_put_contents($logFile, "timestamp,airport,name,email,grid,assets,parties,flex,top_strategy\n");
}
file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

echo json_encode(['ok' => true, 'sent' => $sent]);
