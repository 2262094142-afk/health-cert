@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动健康证明同步服务...
echo 请不要关闭此窗口，上传图片需要此服务运行
echo.
"C:\Users\win10\.workbuddy\binaries\node\versions\22.22.2\node.exe" server.js
if errorlevel 1 (
  echo.
  echo 启动失败，请按任意键退出
  pause >nul
)
