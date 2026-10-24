-- Spatial entities: driver profile with last known position, and pickup/dropoff addresses.

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'BUSY');

-- CreateTable
CREATE TABLE "Driver" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'MOTORBIKE',
    "status" "DriverStatus" NOT NULL DEFAULT 'OFFLINE',
    "currentLocation" geography(Point,4326),
    "lastLocationAt" TIMESTAMP(3),

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "line" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "location" geography(Point,4326) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nearest-driver search filters on this column with ST_DWithin.
CREATE INDEX "driver_location_gist" ON "Driver" USING GIST ("currentLocation");
