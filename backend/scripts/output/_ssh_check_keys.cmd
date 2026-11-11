@echo off
setlocal
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" (echo KEY_DRC) else (echo NO_DRC)
if exist "%USERPROFILE%\.ssh\id_ed25519" (echo KEY_ED25519) else (echo NO_ED25519)
if exist "%USERPROFILE%\.ssh\id_rsa" (echo KEY_RSA) else (echo NO_RSA)
endlocal
