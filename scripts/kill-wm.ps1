# Kill running instances of the app to avoid file lock during build
# Run from project root in an elevated PowerShell if necessary

$procName = 'Warehouse Management'
try {
    Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping process id=$($_.Id) name=$($_.ProcessName)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}
catch {
    # fallback to taskkill if Stop-Process failed
    Start-Process -FilePath 'taskkill' -ArgumentList '/F','/IM','Warehouse Management.exe','/T' -NoNewWindow -Wait -ErrorAction SilentlyContinue
}

# double-check
Start-Sleep -Milliseconds 300
Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Process still running: id=$($_.Id)"
}

Write-Host 'Done.'
