param([string]$Raw, [string]$Out)
$text = Get-Content -LiteralPath $Raw -Raw -Encoding UTF8
function Get-FirstStatus($block) {
  if ($block -match 'HTTP/\S+\s+(\d+)') { return $Matches[1] }
  return 'unknown'
}
$siteUp = ($text -match '(?ms)=== 1\. curl.*?drc\.ao-nk\.online\s*\r?\n.*?HTTP/\S+\s+(2\d\d|3\d\d)') -or ($text -match 'HTTP/\d\.\d 200')
$apiBlock = if ($text -match '(?ms)curl -I.*?/api/.*?(?=\r?\n\r?\n|\r?\n===)') { $Matches[0] } else { '' }
$apiStatus = Get-FirstStatus $apiBlock
$apiUp = $apiStatus -match '^2|^3'
$backendActive = if ($text -match '(?m)^active') { 'active' } elseif ($text -match '(?m)^inactive') { 'inactive' } elseif ($text -match '(?m)^failed') { 'failed' } else { 'unknown' }
$nginxActive = 'unknown'
if ($text -match '(?ms)=== 2\. systemctl.*?^active\r?\nactive') { $nginxActive = 'active' }
elseif ($text -match '(?ms)is-active nginx\r?\n(\w+)') { $nginxActive = $Matches[1] }
$oom = ($text -match '(?i)out of memory|oom-kill|killed process') -or ($text -match '(?i)Cannot allocate memory')
$diskWarn = $text -match '(?m)/\s+\S+\s+\S+\s+\S+\s+(\d{2,3})%' -and [int]$Matches[1] -ge 90
$memLine = ([regex]::Matches($text, '(?m)^Mem:\s+(.+)$') | Select-Object -First 1).Groups[1].Value
$dfLine = ([regex]::Matches($text, '(?m)^/\s+(.+)$') | Select-Object -First 1).Groups[1].Value
$uptimeLine = ([regex]::Matches($text, '(?m)^\s*\d{2}:\d{2}:\d{2}\s+up\s+.+$') | Select-Object -First 1).Value
$journalTail = [regex]::Matches($text, '(?ms)=== 4\. journalctl.*?=== 5') | ForEach-Object { $_.Value -replace '^=== 4\. journalctl drc-backend ===\r?\n','' -replace '\r?\n=== 5.*','' }
$lastLogs = ($journalTail -split "`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 8) -join "`n"
$nginxErr = if ($text -match '(?ms)=== 5\. nginx error log tail ===(.*?)=== 6') { $Matches[1].Trim() } else { '' }
$distInfo = if ($text -match '(?ms)=== 6\. frontend dist ===(.*)$') { $Matches[1].Trim() } else { '' }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("DRC production health summary")
[void]$sb.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Site up? $(if($siteUp){'YES'}else{'NO / check raw'})")
[void]$sb.AppendLine("API up? $(if($apiUp){'YES (HTTP '+$apiStatus+')'}elseif($apiStatus -eq 'unknown'){'UNKNOWN (timeout or no response — see raw)'}else{'NO (HTTP '+$apiStatus+')'})")
[void]$sb.AppendLine("Backend unit: $backendActive")
[void]$sb.AppendLine("Nginx unit: $nginxActive")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Resources:")
if ($memLine) { [void]$sb.AppendLine("  Mem: $memLine") }
if ($dfLine) { [void]$sb.AppendLine("  /: $dfLine") }
if ($uptimeLine) { [void]$sb.AppendLine("  $uptimeLine") }
[void]$sb.AppendLine("")
[void]$sb.AppendLine("OOM signals: $(if($oom){'YES — see journal/raw'}else{'none in collected logs'})")
[void]$sb.AppendLine("Disk >=90% on /: $(if($diskWarn){'YES'}else{'no'})")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Frontend dist:")
[void]$sb.AppendLine($distInfo)
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Recent nginx errors (if any):")
[void]$sb.AppendLine($(if($nginxErr){$nginxErr}else{'(none captured)'}))
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Last drc-backend journal lines:")
[void]$sb.AppendLine($(if($lastLogs){$lastLogs}else{'(none captured)'}))
[void]$sb.AppendLine("")
[void]$sb.AppendLine("--- Full raw capture: $Raw ---")
$sb.ToString() | Set-Content -LiteralPath $Out -Encoding UTF8
