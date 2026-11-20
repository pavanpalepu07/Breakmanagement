<#
Creates the "BreakLog" SharePoint list used by the app. Run once as a site owner.
Requires: Install-Module PnP.PowerShell
Usage:   ./Create-BreakList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/ContactCenter
#>
param([Parameter(Mandatory)][string]$SiteUrl, [string]$ListName = "BreakLog")

Connect-PnPOnline -Url $SiteUrl -Interactive
New-PnPList -Title $ListName -Template GenericList -OnQuickLaunch:$false | Out-Null

Add-PnPField -List $ListName -DisplayName "AgentEmail"      -InternalName "AgentEmail"      -Type Text     -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "Team"            -InternalName "Team"            -Type Text     -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "BreakType"       -InternalName "BreakType"       -Type Text     -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "StartTime"       -InternalName "StartTime"       -Type DateTime -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "EndTime"         -InternalName "EndTime"         -Type DateTime -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "DurationMinutes" -InternalName "DurationMinutes" -Type Number   -AddToDefaultView | Out-Null
Add-PnPField -List $ListName -DisplayName "Status"          -InternalName "Status"          -Type Text     -AddToDefaultView | Out-Null

# Index the columns the app filters on so queries keep working past 5,000 items
foreach ($f in "AgentEmail", "StartTime", "Status") {
  Set-PnPField -List $ListName -Identity $f -Values @{ Indexed = $true }
}
Write-Host "List '$ListName' created."
