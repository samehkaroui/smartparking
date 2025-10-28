$body = @{
    totalSpaces = 20
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3002/api/parking/generate-spaces" -Method POST -ContentType "application/json" -Body $body
