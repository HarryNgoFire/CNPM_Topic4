<#
  M4 probe: can a non-driver move a shipment through the delivery lifecycle?
  Expected by design: only the assigned DRIVER (and ADMIN when a driver is assigned) may progress a shipment;
  a SENDER may only CANCEL. Run from the repository root while the stack is up:

    .\scripts\qa\probe-sender-transition.ps1
    .\scripts\qa\probe-sender-transition.ps1 -EmailDomain demo.local   # old demo accounts

  It creates two test shipments in the database you are running against.
#>
param(
  [string]$Password = "",
  [string]$Base = "http://localhost:3001/api/v1",
  [string]$EmailDomain = "gmail.com"
)
$ErrorActionPreference = "Stop"

function EnvValue([string]$Name) {
  if (-not (Test-Path .env)) { return "" }
  $line = Select-String -Path .env -Pattern "^$Name=(.*)$" | Select-Object -First 1
  if ($line) { return $line.Matches[0].Groups[1].Value.Trim().Trim('"') }
  return ""
}
if (-not $Password) { $Password = EnvValue "DEMO_PASSWORD" }
if (-not $Password) { throw "No password: set DEMO_PASSWORD in .env (run from the repo root) or pass -Password." }
if ($Password.StartsWith("<")) { throw "The password still contains a placeholder. Use the real value, without < >." }

function Api([string]$Method, [string]$Path, [string]$Token = "", $Body = $null) {
  $p = @{ Method = $Method; Uri = "$Base$Path"; ContentType = "application/json" }
  if ($Token) { $p.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 6) }
  Invoke-RestMethod @p
}
function Login([string]$Email) {
  (Api POST "/auth/login" "" @{ email = $Email; password = $Password }).accessToken
}
function TryGo([string]$Label, [string]$Id, [string]$Token, [string]$To) {
  $status = 200
  $body = ""
  try { Api POST "/shipments/$Id/transition" $Token @{ toStatus = $To } | Out-Null } catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { $status = 0 }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $body = $_.ErrorDetails.Message }
  }
  $now = (Api GET "/shipments/$Id" $sender).status
  "{0,-22} -> {1,-17} HTTP {2}   shipment is now: {3}   {4}" -f $Label, $To, $status, $now, $body
}

$sender     = Login "sender@$EmailDomain"
$driverB    = Login "driver-b@$EmailDomain"
$dispatcher = Login "dispatcher@$EmailDomain"

$booking = @{
  pickupAddress  = @{ line = "12 Nguyen Trai"; ward = "1"; district = "5"; city = "HCMC"; lat = 10.754;  lng = 106.663 }
  dropoffAddress = @{ line = "88 Le Loi"; ward = "1"; district = "1"; city = "HCMC"; lat = 10.7575; lng = 106.6665 }
  parcel = @{ weightKg = 5; lengthCm = 30; widthCm = 20; heightCm = 15 }
  serviceType = "EXPRESS"
}

"=== Shipment 1: the SENDER (owner) tries to progress the shipment ==="
$s1 = Api POST "/shipments" $sender $booking
"created shipment $($s1.id), status $($s1.status)"
foreach ($to in "EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", "DELIVERED") {
  TryGo "SENDER (owner)" $s1.id $sender $to
}

"=== Shipment 2: people who are NOT the assigned driver try to progress it ==="
$s2 = Api POST "/shipments" $sender $booking
"created shipment $($s2.id), status $($s2.status)"
TryGo "DRIVER B (unassigned)" $s2.id $driverB "EN_ROUTE_PICKUP"
TryGo "DISPATCHER" $s2.id $dispatcher "EN_ROUTE_PICKUP"

""
"How to read this: every line above should show HTTP 403 (or 409) and the status must stay RECEIVED."
"HTTP 200 with a changed status means a non-driver can move the shipment: report it as a HIGH severity access-control bug."
