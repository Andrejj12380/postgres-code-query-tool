# One-click PowerShell launcher: starts server and frontend hidden and opens default browser
Set-Location -Path $PSScriptRoot

# Default server port for the local backend (can be changed if needed)
$env:SERVER_PORT = '3005'
$env:PORT = $env:SERVER_PORT

Start-Process -FilePath "npm" -ArgumentList "run","dev:server" -WindowStyle Hidden
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WindowStyle Hidden



Start-Process "http://localhost:3000"nStart-Sleep -Seconds 3