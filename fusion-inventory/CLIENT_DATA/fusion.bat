:: Tasks anlegen
schtasks.exe /create /f /tn FusionInventory-Agent-Start /ru SYSTEM /tr "C:\Fusion-Inventory\fusioninventory-agent.bat --force" /sc ONSTART /delay 0005:00
schtasks.exe /create /f /tn FusionInventory-Agent-Intervall /ru SYSTEM /tr "C:\Fusion-Inventory\fusioninventory-agent.bat --force" /sc DAILY
pause

