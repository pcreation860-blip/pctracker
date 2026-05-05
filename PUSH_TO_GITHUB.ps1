# PCTracker - Push to GitHub
# Run this from inside the pctracker folder

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "   PCTracker - Push to GitHub"  -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

# Go to script directory
Set-Location $PSScriptRoot

Write-Host "Step 1: Setting up Git..." -ForegroundColor Yellow
git init
git config user.email "pcreation860@gmail.com"
git config user.name "P Creation VISH"

Write-Host ""
Write-Host "Step 2: Adding all files..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "Step 3: Committing..." -ForegroundColor Yellow
git commit -m "PCTracker update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

Write-Host ""
Write-Host "Step 4: Setting branch..." -ForegroundColor Yellow
git branch -M main

Write-Host ""
Write-Host "Step 5: Connecting to GitHub..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin https://github.com/pcreation860-blip/pctracker.git

Write-Host ""
Write-Host "Step 6: Pushing to GitHub..." -ForegroundColor Yellow
Write-Host ""
Write-Host ">>> When asked for password - paste your GitHub Token (ghp_xxxxx)" -ForegroundColor Red
Write-Host ""
git push -u origin main --force

Write-Host ""
Write-Host "========================================"
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS! Code is on GitHub!" -ForegroundColor Green
    Write-Host "Vercel will auto-deploy in 2 minutes." -ForegroundColor Green
    Write-Host "Then open pctracker.in" -ForegroundColor Green
} else {
    Write-Host "ERROR! Push failed." -ForegroundColor Red
    Write-Host "Check your GitHub token and try again." -ForegroundColor Red
}
Write-Host "========================================"
Write-Host ""
Read-Host "Press Enter to close"
