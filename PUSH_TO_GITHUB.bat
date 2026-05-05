@echo off
echo ========================================
echo    PCTracker - Push to GitHub
echo ========================================
echo.
cd /d "%~dp0"
git init
git config user.email "pcreation860@gmail.com"
git config user.name "P Creation VISH"
git add .
git commit -m "PCTracker update"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/pcreation860-blip/pctracker.git
echo.
echo IMPORTANT: When asked for password, paste your GitHub Token (ghp_xxxxx)
echo.
git push -u origin main --force
echo.
if %errorlevel%==0 (
    echo SUCCESS! Vercel will auto-deploy in 2 minutes.
) else (
    echo ERROR - check your GitHub token.
)
pause
