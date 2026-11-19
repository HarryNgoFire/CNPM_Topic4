<#
  M4 smoke test for the two-stage delivery lifecycle (9 statuses, server-side geofence, GPS validation).
  Run it from the repository root (so that .env can be found) while the stack is up (docker compose up -d).

    .\scripts\qa\smoke-flow.ps1                    # password is read from DEMO_PASSWORD in .env
    .\scripts\qa\smoke-flow.ps1 -RegisterWebhook   # also register the demo webhook (ONLY ONCE per database)
    .\scripts\qa\smoke-flow.ps1 -EmailDomain demo.local   # for databases seeded with the old demo.local accounts

  The run takes about 40 seconds: it waits between GPS updates so that the server-side speed check
  sees realistic travel. Routing (OSRM) needs Internet access.
#>
param(
  [string]$Password = "",
  [string]$ReceiverSecret = "",
  [string]$Base = "http://localhost:3001/api/v1",
  [string]$EmailDomain = "gmail.com",
  [switch]$RegisterWebhook
)
$ErrorActionPreference = "Stop"
$script:failed = 0

function EnvValue([string]$Name) {
  if (-not (Test-Path .env)) { return "" }
  $line = Select-String -Path .env -Pattern "^$Name=(.*)$" | Select-Object -First 1
  if ($line) { return $line.Matches[0].Groups[1].Value.Trim().Trim('"') }
  return ""
}
if (-not $Password) { $Password = EnvValue "DEMO_PASSWORD" }
if (-not $Password) { throw "No password: set DEMO_PASSWORD in .env (run from the repo root) or pass -Password." }
if ($Password.StartsWith("<")) { throw "The password still contains a placeholder. Use the real value, without < >." }
if ($ReceiverSecret) { $RegisterWebhook = $true }
if ($RegisterWebhook -and -not $ReceiverSecret) { $ReceiverSecret = EnvValue "WEBHOOK_RECEIVER_SECRET" }

function Api([string]$Method, [string]$Path, [string]$Token = "", $Body = $null) {
  $p = @{ Method = $Method; Uri = "$Base$Path"; ContentType = "application/json" }
  if ($Token) { $p.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 6) }
  Invoke-RestMethod @p
}
function Expect([string]$Name, [int[]]$Codes, [scriptblock]$Call) {
  $status = 200
  $body = ""
  try { & $Call | Out-Null } catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { $status = 0 }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $body = $_.ErrorDetails.Message } else { $body = $_.Exception.Message }
  }
  if ($Codes -contains $status) { "PASS  $Name" }
  else { "FAIL  $Name"; "      expected HTTP $($Codes -join '/'), got $status $body"; $script:failed++ }
}
function Login([string]$Email) {
  (Api POST "/auth/login" "" @{ email = $Email; password = $Password }).accessToken
}
function Check([string]$Name, [bool]$Ok) {
  if ($Ok) { "PASS  $Name" } else { "FAIL  $Name"; $script:failed++ }
}
function Stamp([int]$AgeSeconds = 0) {
  (Get-Date).ToUniversalTime().AddSeconds(-$AgeSeconds).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)
}
function MoveDriver([string]$Token, [double]$Lat, [double]$Lng, [double]$Accuracy = 10, [int]$AgeSeconds = 0) {
  Api PATCH "/drivers/me/location" $Token @{ lat = $Lat; lng = $Lng; accuracyM = $Accuracy; capturedAt = (Stamp $AgeSeconds) }
}
function Go([string]$Id, [string]$Token, [string]$To, [string]$Reason = "") {
  $b = @{ toStatus = $To }
  if ($Reason) { $b.reason = $Reason }
  Api POST "/shipments/$Id/transition" $Token $b
}

$sender  = Login "sender@$EmailDomain"
$driverA = Login "driver-a@$EmailDomain"
$driverB = Login "driver-b@$EmailDomain"
$admin   = Login "admin@$EmailDomain"

if ($RegisterWebhook) {
  if (-not $ReceiverSecret) { throw "WEBHOOK_RECEIVER_SECRET not found in .env" }
  Api POST "/webhooks/subscriptions" $admin @{ url = "http://receiver:4000/webhooks/shipment"; secret = $ReceiverSecret } | Out-Null
  "Webhook subscription registered (only needed once per database)"
}

# Geometry: pickup P, driver start F (150 m away: outside the 100 m geofence), drop-off D (about 550 m from P).
$P = @{ lat = 10.754;   lng = 106.663 }
$F = @{ lat = 10.75265; lng = 106.663 }
$D = @{ lat = 10.7575;  lng = 106.6665 }

$booking = @{
  pickupAddress  = @{ line = "12 Nguyen Trai"; ward = "1"; district = "5"; city = "HCMC"; lat = $P.lat; lng = $P.lng }
  dropoffAddress = @{ line = "88 Le Loi"; ward = "1"; district = "1"; city = "HCMC"; lat = $D.lat; lng = $D.lng }
  parcel = @{ weightKg = 5; lengthCm = 30; widthCm = 20; heightCm = 15 }
  serviceType = "EXPRESS"
}

$stale = @(Api GET "/drivers/me/tasks" $driverA)
if ($stale.Count -gt 0) { "WARNING: driver A already has $($stale.Count) task(s) from earlier runs; use a fresh database if the assignment check fails." }

# --- Profile ---
$me = Api GET "/users/me" $sender
Check "GET /users/me returns the sender profile" ((($me | ConvertTo-Json -Compress) -match "sender@$EmailDomain"))

# --- Driver A starts 150 m away from the pickup, then the sender books ---
Api PATCH "/drivers/me/status" $driverA @{ status = "AVAILABLE" } | Out-Null
$r = MoveDriver $driverA $F.lat $F.lng
Check "Driver GPS update near pickup is accepted" ($r.accepted -eq $true)

$quote = Api POST "/pricing/quote" $sender $booking
Check "Quote returns fee > 0 (fee=$($quote.fee))" ($quote.fee -gt 0)
$shipment = Api POST "/shipments" $sender $booking
Check "Shipment created with status RECEIVED" ($shipment.status -eq "RECEIVED")
$id = $shipment.id

$tasks = Api GET "/drivers/me/tasks" $driverA
$assignment = @($tasks) | Where-Object { $_.shipmentId -eq $id } | Select-Object -First 1
Check "Nearest driver A received the assignment" ($null -ne $assignment)

# --- Before the driver accepts: only the assigned driver may progress, a sender may only cancel ---
Expect "A sender can only cancel, not progress (403)" @(403) { Go $id $sender "EN_ROUTE_PICKUP" }
$afterSender = (Api GET "/shipments/$id" $sender).status
Check "Shipment stays RECEIVED after the sender's attempt" ($afterSender -eq "RECEIVED")
Expect "A driver cannot progress before accepting the assignment (403)" @(403) { Go $id $driverA "EN_ROUTE_PICKUP" }
Expect "A driver cannot cancel (403)" @(403) { Go $id $driverA "CANCELLED" "driver test" }

# --- Stage 1: accepting the assignment starts the pickup stage (design rule: SRS 4.2 item 4) ---
Api POST "/assignments/$($assignment.id)/respond" $driverA @{ action = "ACCEPT" } | Out-Null
$afterAccept = (Api GET "/shipments/$id" $sender).status
Check "Accepting the assignment moves the shipment to EN_ROUTE_PICKUP" ($afterAccept -eq "EN_ROUTE_PICKUP")
Expect "Skipping a stage (EN_ROUTE_PICKUP -> OUT_FOR_DELIVERY) is blocked (409)" @(409) { Go $id $driverA "OUT_FOR_DELIVERY" }

$nav = Api GET "/shipments/$id/navigation" $driverA
Check "Navigation phase is TO_PICKUP with a PICKUP destination" (($nav.phase -eq "TO_PICKUP") -and ($nav.destination.kind -eq "PICKUP"))
Check "Navigation before pickup does not leak the drop-off point" (-not ((($nav | ConvertTo-Json -Depth 10 -Compress) -match "10\.7575|106\.6665")))
Check "Driver 150 m away is not eligible to arrive" ($nav.arrival.eligible -eq $false)
Expect "Server blocks ARRIVED_PICKUP when outside 100 m (409)" @(409) { Go $id $driverA "ARRIVED_PICKUP" }

"Waiting 8 s so the GPS speed check sees realistic travel..."
Start-Sleep -Seconds 8
$r = MoveDriver $driverA $P.lat $P.lng
Check "Driver GPS update at the pickup is accepted" ($r.accepted -eq $true)
$nav = Api GET "/shipments/$id/navigation" $driverA
Check "Driver at the pickup is eligible to arrive" ($nav.arrival.eligible -eq $true)
$r = Go $id $driverA "ARRIVED_PICKUP"
Check "Transition to ARRIVED_PICKUP" ($r.status -eq "ARRIVED_PICKUP")

# --- Stage 2: go to drop-off ---
$r = Go $id $driverA "OUT_FOR_DELIVERY"
Check "Transition to OUT_FOR_DELIVERY" ($r.status -eq "OUT_FOR_DELIVERY")
$nav = Api GET "/shipments/$id/navigation" $driverA
Check "Navigation phase is TO_DROPOFF with a DROPOFF destination" (($nav.phase -eq "TO_DROPOFF") -and ($nav.destination.kind -eq "DROPOFF"))
Expect "Server blocks ARRIVED_DROPOFF when still at the pickup (409)" @(409) { Go $id $driverA "ARRIVED_DROPOFF" }

"Waiting 15 s so the GPS speed check sees realistic travel..."
Start-Sleep -Seconds 15
$r = MoveDriver $driverA $D.lat $D.lng
Check "Driver GPS update at the drop-off is accepted" ($r.accepted -eq $true)

$live = Api GET "/shipments/$id/live" $sender
Check "Sender (owner) can see the live driver position" (($null -ne $live.driver) -and ([math]::Abs($live.driver.lat - $D.lat) -lt 0.001))
Expect "An unrelated driver cannot see the live position (403/404)" @(403, 404) { Api GET "/shipments/$id/live" $driverB }

$r = Go $id $driverA "ARRIVED_DROPOFF"
Check "Transition to ARRIVED_DROPOFF" ($r.status -eq "ARRIVED_DROPOFF")
$r = Go $id $driverA "DELIVERED"
Check "Transition to DELIVERED" ($r.status -eq "DELIVERED")

# --- Public tracking ---
$t = Api GET "/tracking/$($shipment.trackingCode)"
$timeline = ($t.history | ForEach-Object { $_.toStatus }) -join " > "
Check "Timeline has 6 steps ($timeline)" ($timeline -eq "RECEIVED > EN_ROUTE_PICKUP > ARRIVED_PICKUP > OUT_FOR_DELIVERY > ARRIVED_DROPOFF > DELIVERED")
Check "Public tracking does not leak senderId" (-not ($t.PSObject.Properties.Name -contains "senderId"))
"Tracking fields returned: " + (($t.PSObject.Properties.Name) -join ", ")
Expect "Driver cannot move a delivered shipment (403 not assigned, or 409)" @(403, 409) { Go $id $driverA "ARRIVED_PICKUP" }
Expect "Admin cannot move a delivered shipment (409)" @(409) { Go $id $admin "ARRIVED_PICKUP" }
$afterDelivered = (Api GET "/shipments/$id" $sender).status
Check "Delivered shipment stays DELIVERED" ($afterDelivered -eq "DELIVERED")

# --- Cancellation path (reason is mandatory) ---
$second = Api POST "/shipments" $sender $booking
Check "Second shipment created" ($second.status -eq "RECEIVED")
Expect "Cancel without a reason is rejected (400)" @(400) { Go $second.id $sender "CANCELLED" }
$r = Go $second.id $sender "CANCELLED" "QA smoke test: sender changed mind"
Check "Sender can cancel an unassigned shipment with a reason" ($r.status -eq "CANCELLED")
Expect "Cancelled shipment cannot be progressed (409)" @(409) { Go $second.id $admin "OUT_FOR_DELIVERY" }

# --- GPS trust boundary: the server must reject bad data ---
Expect "GPS accuracy of 500 m is rejected (400)" @(400) { Api PATCH "/drivers/me/location" $driverA @{ lat = $D.lat; lng = $D.lng; accuracyM = 500; capturedAt = (Stamp 0) } }
Expect "GPS timestamp 5 minutes in the future is rejected (400)" @(400) { Api PATCH "/drivers/me/location" $driverA @{ lat = $D.lat; lng = $D.lng; accuracyM = 10; capturedAt = (Stamp -300) } }
Expect "GPS timestamp 10 minutes old is rejected (400)" @(400) { Api PATCH "/drivers/me/location" $driverA @{ lat = $D.lat; lng = $D.lng; accuracyM = 10; capturedAt = (Stamp 600) } }
Expect "GPS jump of about 20 km is rejected as implausible speed (400)" @(400) { Api PATCH "/drivers/me/location" $driverA @{ lat = ($D.lat + 0.18); lng = $D.lng; accuracyM = 10; capturedAt = (Stamp 0) } }

# --- Access control ---
Expect "No token on /shipments -> 401" @(401) { Api GET "/shipments" }
Expect "Driver calling quote -> 403" @(403) { Api POST "/pricing/quote" $driverA $booking }
Expect "Sender calling admin/users -> 403" @(403) { Api GET "/admin/users" $sender }
Expect "Lowercase tracking code -> 400 (current behaviour)" @(400) { Api GET "/tracking/$($shipment.trackingCode.ToLower())" }

if ($script:failed) { "$script:failed CHECK(S) FAILED"; exit 1 } else { "ALL CHECKS PASSED" }
