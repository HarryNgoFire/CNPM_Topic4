-- M4 database checks (M3 layer). Runs inside a transaction and ROLLBACKs at the end.
-- Prerequisite: at least one shipment exists (run scripts/qa/smoke-flow.ps1 first).
-- Run:  Get-Content scripts/qa/db-checks.sql -Raw | docker compose exec -T db psql -U topic4 -d topic4
BEGIN;

CREATE FUNCTION pg_temp.expect_error(label text, stmt text) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE NOTICE 'FAIL  %: statement should have been rejected', label;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS  %: %', label, SQLERRM;
  END;
END $f$;

SELECT pg_temp.expect_error('shipment fee is an immutable snapshot',
  $q$UPDATE "Shipment" SET fee = fee + 1 WHERE id = (SELECT id FROM "Shipment" LIMIT 1)$q$);
SELECT pg_temp.expect_error('status history is append-only (DELETE blocked)',
  $q$DELETE FROM "ShipmentStatusHistory" WHERE id = (SELECT id FROM "ShipmentStatusHistory" LIMIT 1)$q$);
SELECT pg_temp.expect_error('parcel weight must be > 0',
  $q$UPDATE "Parcel" SET "weightKg" = 0 WHERE id = (SELECT id FROM "Parcel" LIMIT 1)$q$);
SELECT pg_temp.expect_error('pricing rule cannot have negative price',
  $q$UPDATE "PricingRule" SET "baseFee" = -1 WHERE id = (SELECT id FROM "PricingRule" LIMIT 1)$q$);
SELECT pg_temp.expect_error('cannot delete a user that owns shipments (FK RESTRICT)',
  $q$DELETE FROM "User" WHERE id = (SELECT "senderId" FROM "Shipment" LIMIT 1)$q$);

SELECT PostGIS_Version() AS postgis_version;
SELECT count(*) AS required_indexes_expect_3 FROM pg_indexes
 WHERE indexname IN ('one_active_assignment_per_shipment','one_active_assignment_per_driver','driver_location_gist');
SELECT count(*) AS required_triggers_expect_2 FROM pg_trigger
 WHERE tgname IN ('shipment_fee_immutable','history_append_only');
SELECT role, count(*) AS users FROM "User" GROUP BY role ORDER BY role;
SELECT round(ST_Distance('SRID=4326;POINT(106.663 10.754)'::geography,
                         'SRID=4326;POINT(106.698 10.772)'::geography)) AS meters_expect_about_4300;

ROLLBACK;
