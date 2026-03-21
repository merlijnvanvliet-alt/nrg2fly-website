<?php
// ===== NRG2fly News API proxy =====
// Fetches Published articles from the Notion database and returns JSON.
// Place your Notion integration token below.

define('NOTION_TOKEN',    'ntn_z7472365667b9AWGGP8xOSCwZrFKo9NRCt3UnjkUw8OelC');
define('NOTION_DATABASE', 'adc992c0-788d-408a-99a8-deb68c92a47f');
define('NOTION_VERSION',  '2022-06-28');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// --- Query Notion for Published articles, newest first ---
$payload = json_encode([
    'filter' => [
        'property' => 'Published',
        'checkbox'  => ['equals' => true],
    ],
    'sorts' => [
        ['property' => 'Date', 'direction' => 'descending'],
    ],
    'page_size' => 50,
]);

$ch = curl_init('https://api.notion.com/v1/databases/' . NOTION_DATABASE . '/query');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . NOTION_TOKEN,
        'Notion-Version: '       . NOTION_VERSION,
        'Content-Type: application/json',
    ],
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $status !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch from Notion', 'status' => $status]);
    exit;
}

$data = json_decode($response, true);
$articles = [];

foreach ($data['results'] as $page) {
    $props = $page['properties'];

    $title    = $props['Title']['title'][0]['plain_text']   ?? '';
    $category = $props['Category']['select']['name']        ?? '';
    $date     = $props['Date']['date']['start']             ?? '';
    $image    = $props['Image']['url']                      ?? '';
    $intro    = $props['Intro']['rich_text'][0]['plain_text'] ?? '';
    $link     = $props['Link']['url']                       ?? '';

    if ($title === '') continue;

    $articles[] = [
        'id'       => $page['id'],
        'title'    => $title,
        'category' => $category,
        'date'     => $date,
        'image'    => $image,
        'intro'    => $intro,
        'link'     => $link,
    ];
}

echo json_encode($articles);
