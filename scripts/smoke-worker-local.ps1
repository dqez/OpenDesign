$ErrorActionPreference = "Stop"

$body = @{
  url = "https://neon.com"
  email = "user@example.com"
} | ConvertTo-Json

$response = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8787/api/extract" -Body $body -ContentType "application/json"
if ($response.StatusCode -ne 202) {
  throw "Expected 202 from first extract, got $($response.StatusCode)"
}

$json = $response.Content | ConvertFrom-Json
$job = Invoke-WebRequest -Method Get -Uri "http://127.0.0.1:8787/api/jobs/$($json.jobId)"
if ($job.StatusCode -ne 200) {
  throw "Expected 200 from job polling, got $($job.StatusCode)"
}

for ($i = 0; $i -lt 6; $i++) {
  try {
    $rateResponse = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8787/api/extract" -Body $body -ContentType "application/json"
  } catch {
    $rateResponse = $_.Exception.Response
  }
}

if ($rateResponse.StatusCode.value__ -ne 429) {
  throw "Expected 429 from 6th request in one minute, got $($rateResponse.StatusCode)"
}
