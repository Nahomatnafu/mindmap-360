param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$runtime = Join-Path $projectRoot '.preview-runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$cloudflared = Join-Path $runtime 'cloudflared.exe'
if (!(Test-Path -LiteralPath $cloudflared)) { throw 'Install cloudflared from Cloudflare and place cloudflared.exe in .preview-runtime first.' }
foreach ($port in @(3000, 3002)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Close the existing preview before starting another." }
}
if (!$SkipBuild) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } }
$node = (Get-Command node.exe).Source
$server = Start-Process -FilePath $node -ArgumentList 'node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'server.log') -RedirectStandardError (Join-Path $runtime 'server-error.log')
$server.Id | Set-Content (Join-Path $runtime 'server.pid')
$gateway = Start-Process -FilePath $node -ArgumentList 'scripts/phone-preview-gateway.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'gateway.log') -RedirectStandardError (Join-Path $runtime 'gateway-error.log')
$gateway.Id | Set-Content (Join-Path $runtime 'gateway.pid')
$tunnel = Start-Process -FilePath $cloudflared -ArgumentList 'tunnel --url http://127.0.0.1:3002 --no-autoupdate' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'tunnel.log') -RedirectStandardError (Join-Path $runtime 'tunnel-error.log')
$tunnel.Id | Set-Content (Join-Path $runtime 'tunnel.pid')
Write-Output 'Preview started. Keep this computer awake. Find the new HTTPS URL in .preview-runtime/tunnel-error.log and add /?preview=1.'
Write-Output 'The demo AI code is in .preview-runtime/demo-access-code.txt. Never share your OpenRouter API key.'
