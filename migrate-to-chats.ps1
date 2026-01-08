# PowerShell script for migrating App.jsx
# Replace channels with chats and selectedChannel with selectedChat

Write-Host "Starting App.jsx migration..." -ForegroundColor Cyan

$appJsxPath = "frontend\src\App.jsx"

# Check if file exists
if (!(Test-Path $appJsxPath)) {
    Write-Host "File $appJsxPath not found!" -ForegroundColor Red
    exit 1
}

# Create backup
Copy-Item $appJsxPath "$appJsxPath.backup" -Force
Write-Host "Backup created: App.jsx.backup" -ForegroundColor Green

# Read file
$content = Get-Content $appJsxPath -Raw -Encoding UTF8

# Replacements (order matters!)
$content = $content -replace '\bchannels\b', 'chats'
$content = $content -replace '\bsetChannels\b', 'setChats'
$content = $content -replace '\bselectedChannel\b', 'selectedChat'
$content = $content -replace '\bsetSelectedChannel\b', 'setSelectedChat'
$content = $content -replace 'channelId', 'chatId'

# Save
$content | Set-Content $appJsxPath -Encoding UTF8 -NoNewline

Write-Host "Migration completed!" -ForegroundColor Green
Write-Host "File updated: $appJsxPath" -ForegroundColor Yellow
Write-Host "Backup: $appJsxPath.backup" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now restart frontend: cd frontend && npm start" -ForegroundColor Cyan
