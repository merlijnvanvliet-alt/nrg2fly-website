<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache');
$data = @file_get_contents('https://e-flight-open-data.s3.nl-ams.scw.cloud/eflight-flight-data.json');
if ($data === false) {
    echo '[]';
} else {
    echo $data;
}
