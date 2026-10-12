-- BR-PRICE-02: a later pricing rule must never rewrite the fee stored on an existing shipment.
CREATE FUNCTION protect_shipment_fee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.fee IS DISTINCT FROM OLD.fee OR NEW."feeBreakdown" IS DISTINCT FROM OLD."feeBreakdown" THEN
  RAISE EXCEPTION 'Shipment fee snapshot is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipment_fee_immutable BEFORE UPDATE ON "Shipment" FOR EACH ROW EXECUTE FUNCTION protect_shipment_fee();
