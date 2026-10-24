<#
  M4 smoke test: runs the full delivery flow against a running API.
  Usage:
    .\scripts\qa\smoke-flow.ps1 -Password "<DEMO_PASSWORD>" [-ReceiverSecret "<WEBHOOK_RECEIVER_SECRET>"]
  Prerequisite: docker compose up -d, and "npm run db:seed" already executed.
#>
param(
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$Base = "http://localhost:3001/api/v1",
  [string]$ReceiverSecret = ""
)
$ErrorActionPreference = "Stop"
$script:failed = 0

function Api([string]$Method, [string]$Path, [string]$Token = "", $Body = $null) {
  $p = @{ Method = $Method; Uri = "$Base$Path"; ContentType = "application/json" }
  if ($Token) { $p.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 6) }
  Invoke-RestMethod @p
}
function StatusOf($Script) {
  try { & $Script | Out-Null; return 200 } catch { return [int]$_.Exception.Response.StatusCode }
}
function Login([string]$Email) {
  (Api POST "/auth/login" "" @{ email = $Email; password = $Password }).accessToken
}
function Check([string]$Name, [bool]$Ok) {
  if ($Ok) { "PASS  $Name" } else { "FAIL  $Name"; $script:failed++ }
}

$sender = Login "sender@demo.local"
$driver = Login "driver-a@demo.local"
$admin  = Login "admin@demo.local"

if ($ReceiverSecret) {
  Api POST "/webhooks/subscriptions" $admin @{ url = "http://receiver:4000/webhooks/shipment"; secret = $ReceiverSecret } | Out-Null
  "Webhook subscription registered (only needed once)"
}

# Seed driver location is only valid for 5 minutes, so refresh it before booking.
Api PATCH "/drivers/me/location" $driver @{ lat = 10.754; lng = 106.663 } | Out-Null

$booking = @{
  pickupAddress  = @{ line = "12 Nguyen Trai"; ward = "1"; district = "5"; city = "HCMC"; lat = 10.754; lng = 106.663 }
  dropoffAddress = @{ line = "88 Le Loi"; ward = "1"; district = "1"; city = "HCMC"; lat = 10.772; lng = 106.698 }
  parcel = @{ weightKg = 5; lengthCm = 30; widthCm = 20; heightCm = 15 }
  serviceType = "EXPRESS"
}

$quote = Api POST "/pricing/quote" $sender $booking
Check "Quote returns fee > 0 (fee=$($quote.fee))" ($quote.fee -gt 0)

$shipment = Api POST "/shipments" $sender $booking
Check "Shipment created with status RECEIVED" ($shipment.status -eq "RECEIVED")

$tasks = Api GET "/drivers/me/tasks" $driver
$assignment = @($tasks) | Where-Object { $_.shipmentId -eq $shipment.id } | Select-Object -First 1
Check "Driver A received the assignment" ($null -ne $assignment)

Api POST "/assignments/$($assignment.id)/respond" $driver @{ action = "ACCEPT" } | Out-Null
foreach ($s in "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED") {
  $r = Api POST "/shipments/$($shipment.id)/transition" $driver @{ toStatus = $s }
  Check "Transition to $s" ($r.status -eq $s)
}

$t = Api GET "/tracking/$($shipment.trackingCode)"
$timeline = ($t.history | ForEach-Object { $_.toStatus }) -join " > "
Check "Timeline has 4 steps ($timeline)" ($timeline -eq "RECEIVED > IN_TRANSIT > OUT_FOR_DELIVERY > DELIVERED")
Check "Public tracking does not leak senderId" (-not ($t.PSObject.Properties.Name -contains "senderId"))
"Tracking fields returned: " + (($t.PSObject.Properties.Name) -join ", ")

Check "Transition after DELIVERED is blocked (409)" ((StatusOf { Api POST "/shipments/$($shipment.id)/transition" $driver @{ toStatus = "RECEIVED" } }) -eq 409)
Check "No token on /shipments -> 401" ((StatusOf { Api GET "/shipments" }) -eq 401)
Check "Driver calling quote -> 403" ((StatusOf { Api POST "/pricing/quote" $driver $booking }) -eq 403)
Check "Lowercase tracking code -> 400 (current behaviour)" ((StatusOf { Api GET "/tracking/$($shipment.trackingCode.ToLower())" }) -eq 400)

if ($script:failed) { "$script:failed CHECK(S) FAILED"; exit 1 } else { "ALL CHECKS PASSED" }
