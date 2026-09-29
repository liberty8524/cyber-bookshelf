$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.venv/Scripts/python.exe')) { throw '请先按 README 安装 Python 虚拟环境与依赖。' }
if (!(Test-Path 'dist/index.html')) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }
}
Write-Host '藏间已启动，请打开 http://127.0.0.1:8000'
& ./.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
