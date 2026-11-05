@echo off
cd /d "%~dp0"
echo EZ-Bikes: http://127.0.0.1:3186
node server.mjs
if errorlevel 1 pause
