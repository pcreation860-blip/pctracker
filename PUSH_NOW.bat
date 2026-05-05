@echo off
title PCTracker - GitHub Push
color 0A
cls
echo.
echo  ==========================================
echo   PCTracker - Pushing to GitHub
echo  ==========================================
echo.

cd /d "%~dp0"

echo [1/6] Initializing Git...
git init >nul 2>&1

echo [2/6] Setting identity...
git config user.email "pcreation860@gmail.com" >nul 2>&1
git config user.name "PCTracker" >nul 2>&1

echo [3/6] Staging files...
git add -A >nul 2>&1

echo [4/6] Committing...
git commit -m "update %date% %time%" >nul 2>&1

echo [5/6] Setting up remote...
git branch -M main >nul 2>&1
git remote remove origin >nul 2>&1

echo.
echo  ==========================================
echo   ENTER YOUR GITHUB TOKEN BELOW
echo   (looks like: ghp_xxxxxxxxxxxx)
echo  ==========================================
echo.
set /p TOKEN=Paste your GitHub token and press Enter: 

git remote add origin https://pcreation860-blip:%TOKEN%@github.com/pcreation860-blip/pctracker.git

echo.
echo [6/6] Pushing to GitHub...
git push -u origin main --force

echo.
if %errorlevel%==0 (
    color 0A
    echo  ==========================================
    echo   SUCCESS! Code is now on GitHub!
    echo   Wait 2 minutes then open pctracker.in
    echo  ==========================================
) else (
    color 0C
    echo  ==========================================
    echo   FAILED - Check your token and try again
    echo  ==========================================
)
echo.
pause
