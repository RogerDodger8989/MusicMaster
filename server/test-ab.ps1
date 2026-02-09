# Test AcousticBrainz API
$mbids = @(
    '9976f567-f267-4d2e-9792-2e5ae5618e7c',  # Chic 'n' Stu
    '834c1cf4-2ba9-4b77-969d-6ac087e4b7f1',  # Innervision
    '6e3d727d-f3f9-458b-8bcf-554eecee5aa6'   # Bubbles
)

Write-Host "Testing AcousticBrainz API for known SOAD tracks...`n"

foreach ($mbid in $mbids) {
    try {
        $url = "https://acousticbrainz.org/api/v1/$mbid/high-level"
        Write-Host "Testing: $mbid"
        
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $data = $response.Content | ConvertFrom-Json
        
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ Found data!"
            Write-Host "  Keys: $($data | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)"
        } else {
            Write-Host "  ❌ No data (HTTP $($response.StatusCode))"
        }
    } catch {
        Write-Host "  ❌ Not found or error"
    }
    Write-Host ""
}
