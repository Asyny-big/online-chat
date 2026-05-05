# Collects GovChat in-app VPN diagnostic logs from a connected Android device.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\tools\collect-vpn-logs.ps1
#
# Output: writes a timestamped folder under .\tools\vpn-logs\ containing
#   - logcat-filtered.txt    only GovChat / sing-box / VPN tags
#   - logcat-full.txt        full unfiltered logcat dump
#   - sing-box-stderr.log    native sing-box stderr captured by libbox
#   - device-info.txt        Android version, model, build, network state
#
# Requires:
#   - adb in PATH (or under %LOCALAPPDATA%\Android\Sdk\platform-tools)
#   - the phone authorised for USB / Wi-Fi debugging

# Continue past native-command stderr noise (adb writes its progress to stderr).
$ErrorActionPreference = "Continue"

$packageName = "ru.govchat.app"
$singBoxStderrPath = "/storage/emulated/0/Android/data/$packageName/files/tunnel-logs/sing-box-stderr.log"

function Resolve-AdbPath {
    $candidate = Get-Command adb -ErrorAction SilentlyContinue
    if ($candidate) { return $candidate.Source }
    $sdkAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
    if (Test-Path $sdkAdb) { return $sdkAdb }
    throw "adb not found in PATH and not at $sdkAdb. Install Android Platform Tools or add adb to PATH."
}

# Run an adb subcommand, swallow stderr, return stdout as a string.
# Native commands in PowerShell write to stderr even on success (progress lines)
# and that confuses the pipeline; this wrapper isolates the native call.
function Invoke-Adb {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    $output = & $script:adb @Args 2>&1 | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
    return ($output -join "`n")
}

# Variant of Invoke-Adb that does not capture stdout but still suppresses
# pipeline-error promotion of stderr. Useful for adb pull where we only care
# about the side effect (file written to disk).
function Invoke-AdbSilently {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    & $script:adb @Args 2>&1 | Out-Null
}

$script:adb = Resolve-AdbPath
Write-Host "Using adb at $script:adb" -ForegroundColor Cyan

$devicesRaw = Invoke-Adb -Args @('devices')
$devices = $devicesRaw -split "`r?`n" | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
if (-not $devices) {
    throw "No authorised Android devices found. Run 'adb devices' to confirm and authorise the device on the phone."
}
Write-Host ("Connected device(s):`n" + ($devices -join "`n")) -ForegroundColor Green

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $PSScriptRoot "vpn-logs\$timestamp"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Write-Host "Writing logs to $outDir" -ForegroundColor Cyan

# 1. Device info
$deviceInfoFile = Join-Path $outDir "device-info.txt"
"### Android device" | Out-File -FilePath $deviceInfoFile -Encoding utf8
"release: $((Invoke-Adb -Args @('shell', 'getprop', 'ro.build.version.release')).Trim())" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8
"sdk: $((Invoke-Adb -Args @('shell', 'getprop', 'ro.build.version.sdk')).Trim())" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8
"manufacturer: $((Invoke-Adb -Args @('shell', 'getprop', 'ro.product.manufacturer')).Trim())" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8
"model: $((Invoke-Adb -Args @('shell', 'getprop', 'ro.product.model')).Trim())" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8

"`n### App package info" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8
$pmDump = Invoke-Adb -Args @('shell', 'pm', 'dump', $packageName)
$pmDump -split "`r?`n" | Select-String "versionName=|versionCode=" | Select-Object -First 2 | ForEach-Object { $_.Line.Trim() } | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8

"`n### Connectivity (top 30 relevant lines)" | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8
$connDump = Invoke-Adb -Args @('shell', 'dumpsys', 'connectivity')
$connDump -split "`r?`n" | Select-String -Pattern "Active|Default network|Validated|TransportInfo|Capabilities" | Select-Object -First 30 | ForEach-Object { $_.Line } | Out-File -Append -FilePath $deviceInfoFile -Encoding utf8

# 2. sing-box native stderr
Write-Host "Pulling sing-box stderr..." -ForegroundColor Cyan
$stderrLocal = Join-Path $outDir "sing-box-stderr.log"
Invoke-AdbSilently -Args @('pull', $singBoxStderrPath, $stderrLocal)
if (-not (Test-Path $stderrLocal)) {
    "sing-box-stderr.log was not present on the device (tunnel may have never started)." | Out-File -FilePath $stderrLocal -Encoding utf8
}

# 3. Full logcat dump
Write-Host "Dumping full logcat..." -ForegroundColor Cyan
$fullLog = Join-Path $outDir "logcat-full.txt"
$logcat = Invoke-Adb -Args @('logcat', '-d', '-v', 'time')
$logcat | Out-File -FilePath $fullLog -Encoding utf8

# 4. Filtered logcat for GovChat / VPN tags
Write-Host "Filtering relevant tags..." -ForegroundColor Cyan
$filterLog = Join-Path $outDir "logcat-filtered.txt"
$pattern = "TunnelManager|InvisibleVpnService|sing-box|NetworkStateTracker|MainViewModel|TunnelAwareRetryInt|SingBoxRunner|SocketGateway|ServerManager|okhttp\.OkHttpClient|GovChatApp"
Get-Content $fullLog | Select-String -Pattern $pattern | ForEach-Object { $_.Line } | Out-File -FilePath $filterLog -Encoding utf8

Write-Host "`nDone. Files in $outDir :" -ForegroundColor Green
Get-ChildItem $outDir | Format-Table Name, Length

Write-Host "`nQuick triage tips:" -ForegroundColor Yellow
Write-Host "  1. Search logcat-filtered.txt for 'BUILD SUCCESSFUL', 'openTun established', 'Protected sing-box outbound'." -ForegroundColor Gray
Write-Host "  2. If 'Unable to resolve host' is present, look in sing-box-stderr.log for 'dns: exchange govchat.ru'." -ForegroundColor Gray
Write-Host "  3. If you see 'outbound/urltest[proxy]: context deadline exceeded' for ALL proxy-N entries, the cached VLESS configs are dead - reconnect to Wi-Fi to refresh the cache." -ForegroundColor Gray
