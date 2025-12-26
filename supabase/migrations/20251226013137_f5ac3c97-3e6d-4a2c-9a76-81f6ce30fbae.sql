-- Add unique constraint for canonical reservation lookup key
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_property_reservation_unique 
UNIQUE (property_id, reservation_id);