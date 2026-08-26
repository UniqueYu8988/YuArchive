$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'start-archive-studio.ps1'
$icon = Join-Path $projectRoot 'assets\archive-studio.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Archive Studio.lnk'
$powershell = Join-Path $PSHOME 'powershell.exe'

if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
  throw 'Archive Studio launcher is missing.'
}

if (-not (Test-Path -LiteralPath $icon -PathType Leaf)) {
  throw 'Archive Studio icon is missing.'
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = 'Open the YuArchive local management tool'
$shortcut.Save()

Write-Output $shortcutPath
