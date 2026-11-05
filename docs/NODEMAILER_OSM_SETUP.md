# MoveFlow: Nodemailer + OpenStreetMap + OSRM

## Gmail SMTP OTP (no purchased domain)
1. Enable Google 2-Step Verification for sender Gmail.
2. Google Account > Security > App passwords (only shown for eligible accounts); create an App Password. This is NOT your regular Gmail password.
3. Copy `.env.example` to `.env`, set `SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM`, `OTP_SECRET`, `JWT_SECRET`. Keep secrets out of Git.
4. Run `docker compose up --build -d`. Test register/OTP via the web UI.
5. For local-only testing use `EMAIL_DELIVERY_MODE=console` (not in production). Check `docker compose logs api` for OTP.

SMTP Gmail: smtp.gmail.com:465/TLS. Gmail can enforce quotas, block automated mail and may not expose App Passwords on managed accounts. This is appropriate for low-volume demos, not high-volume transactional delivery.

## Accurate map pins
- Creating a shipment requires manually selecting both pickup and delivery points on the OpenStreetMap picker. Coordinates are never pre-filled with example pins.
- OpenStreetMap tiles supply map visualization; OSRM calculates driving ROAD distances using the selected coordinates (not motorbike-specific). OSRM public demo is not production SLA and can differ from Google Maps motorbike paths.
- The driver workspace offers Google Maps navigation. Sender shipment detail no longer offers navigation. The backend also only returns navigation URLs on driver detail retrieval; driver tasks already include navigation.
- Existing shipments with bad stored coordinates are NOT auto-corrected: create new shipments with accurate pins or separately migrate/correct existing addresses.

## Commands
```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose logs --tail=100 api
```

The project Dockerfile uses `npm install` so it can resolve Nodemailer despite the previous lockfile. After a successful install on an Internet-connected machine, commit the regenerated `package-lock.json`; then you can switch Dockerfile back to `npm ci` for reproducibility. Third-party tile and routing servers require Internet and should be self-hosted for production scale.
