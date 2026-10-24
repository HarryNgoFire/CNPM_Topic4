-- PostGIS supplies geography(Point,4326), ST_Distance and ST_DWithin for pricing and dispatch.
CREATE EXTENSION IF NOT EXISTS postgis;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
