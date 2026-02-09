# Download all ListenBrainz listens to a JSON file
$username = "dennis800121"
$token = "06bb83a7-d6fe-471c-9da9-5a6cdf5029de"
$outputFile = "listenbrainz_listens.json"

Write-Host "Downloading all ListenBrainz listens for $username..." -ForegroundColor Cyan

$allListens = @()
$maxTs = $null
$page = 1
$continueLoop = $true

while ($continueLoop) {
    $url = "https://api.listenbrainz.org/1/user/$username/listens?count=1000"
    if ($maxTs) {
        $url += "&max_ts=$maxTs"
    }
    
    Write-Host "Fetching page $page..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers @{ "Authorization" = "Token $token" }
        
        $listens = $response.payload.listens
        $allListens += $listens
        
        Write-Host "   OK: Got $($listens.Count) listens (Total: $($allListens.Count))" -ForegroundColor Green
        
        # Get timestamp of oldest listen for next page
        if ($listens.Count -gt 0) {
            $maxTs = $listens[-1].listened_at
        }
        
        # Check if we got all listens
        if ($listens.Count -lt 1000) {
            Write-Host "   Reached end of history" -ForegroundColor Gray
            $continueLoop = $false
        } else {
            $page++
            Start-Sleep -Milliseconds 100
        }
    } catch {
        Write-Host "   Error: $_" -ForegroundColor Red
        $continueLoop = $false
    }
}

Write-Host "`nSaving $($allListens.Count) listens to $outputFile..." -ForegroundColor Cyan
$allListens | ConvertTo-Json -Depth 10 | Out-File $outputFile -Encoding UTF8

Write-Host "Done! All listens saved to $outputFile" -ForegroundColor Green
Write-Host "   Total listens: $($allListens.Count)" -ForegroundColor White
