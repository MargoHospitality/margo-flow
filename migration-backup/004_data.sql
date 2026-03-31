-- ============================================
-- Margo Flow - Production Data Export
-- Generated: 2026-02-06
-- ============================================
-- ============================================
-- 1. RIADS (12 properties)
-- ============================================
INSERT INTO public.riads (id, name, manager_email, manager_whatsapp, cloudbeds_property_id, cloudbeds_sync_enabled, whatsapp_enabled, is_active, created_at, updated_at) VALUES
('a1111111-1111-1111-1111-111111111111', 'Riad Massiba', 'booking@riadmassiba-marrakech.net', '+212625489943', '9462', true, true, true, '2025-12-24 15:01:02.768764+00', '2025-12-29 23:50:45.804221+00'),
('a2222222-2222-2222-2222-222222222222', 'Riad Dar Coram', 'riaddarcoram@gmail.com', '+212662895959', '319156', true, true, true, '2025-12-24 15:01:02.768764+00', '2026-01-13 20:13:53.057986+00'),
('af039d17-d5d4-476c-ac51-9f83c45bbd19', 'Riad Sierra', 'riaddarcoram@gmail.com', '+212662895959', '319158', true, true, true, '2025-12-26 01:15:22.123814+00', '2026-01-13 20:13:47.338047+00'),
('92d7c9dd-42d5-4624-ad02-c2ad55f77fff', 'Palais Chadmi', 'ajal.raja9@gmail.com', '+212607223788', '319364', true, true, true, '2026-01-02 00:42:51.624734+00', '2026-01-05 00:10:56.871243+00'),
('afc6c2d4-cfd9-45b9-b164-32f2b933b385', 'Riad Samsara', 'bouchra@riad-samsara.net', '+212636048559', '319792', true, true, true, '2026-01-02 01:18:04.888146+00', '2026-01-05 00:01:41.098676+00'),
('b68d8c26-cf61-4598-a327-9437facc7611', 'Riad Bindoo', 'riadbindoo@gmail.com', '+212700083434', '319795', true, true, true, '2026-01-02 01:25:05.512258+00', '2026-01-05 00:01:40.191912+00'),
('53a65316-b80a-4683-85ed-f0e7455d12b3', 'Riad Palazzo Montefiore', 'palazzomontefiore@gmail.com', '+212624987173', '318728', true, true, true, '2026-01-05 00:00:35.492242+00', '2026-01-05 14:14:31.394952+00'),
('b4fd95f6-2d25-4691-a1a9-088d02314be5', 'Riad l''Esprit des Patios', 'lespritdespatiosriad@gmail.com', '+212610880968', '319358', true, true, true, '2026-01-11 20:07:14.50696+00', '2026-01-11 20:11:48.261957+00'),
('04827b81-ae72-4dc7-87db-7885c77e56ea', 'Riad Amour', 'leriadamour@gmail.com', '+212670168127', '319368', true, true, true, '2026-01-11 21:51:17.014495+00', '2026-01-11 21:53:55.031642+00'),
('866ab142-bdf6-4d75-93b9-5b59e06c93e0', 'Riad Casa Kasbah', 'jowairiyael2020@gmail.com', '+212767034981', '319157', true, true, true, '2026-01-12 20:50:34.369651+00', '2026-01-12 21:14:33.340675+00'),
('08c11cb8-33a9-435a-8fa0-12269eba032e', 'Riad Elisa & Spa', 'info@riad-elisa.com', '+212666958415', '319843', true, true, true, '2026-01-15 12:31:22.255005+00', '2026-01-15 12:33:32.566126+00'),
('7292fa33-a136-4685-b0fe-76dbe5a8f465', 'Riad Ayadina & Spa', 'inforiadayadina@gmail.com', '+212661213509', '319793', true, true, true, '2026-01-23 11:18:25.594316+00', '2026-01-23 11:23:15.331973+00');
-- ============================================
-- 2. TRANSPORT_OFFERS (8 offers)
-- ============================================
INSERT INTO public.transport_offers (id, name, name_fr, type, fields_schema, default_day_price, default_night_price, default_base_pax, default_extra_pax_price, default_payment_mode, day_start_time, day_end_time, is_active, created_at, updated_at) VALUES
('b1111111-1111-1111-1111-111111111111', 'Airport Pickup (Marrakech)', 'Transfert Aéroport (Marrakech)', 'airport_pickup', '[{"key":"flight_number","label":"Flight Number","label_fr":"Numéro de vol","required":true,"type":"text"},{"key":"arrival_time","label":"Flight Arrival Time","label_fr":"Heure d''arrivée du vol","required":true,"type":"time"},{"key":"terminal","label":"Terminal","label_fr":"Terminal","required":false,"type":"text"}]', 150.00, 200.00, 3, 50.00, 'to_driver', '08:00:00', '20:00:00', true, '2025-12-24 15:01:02.768764+00', '2025-12-28 22:36:39.198852+00'),
('ee8acfea-d211-4da7-be63-aae02df7084f', 'Hotel Pickup (Marrakech)', 'Transfert Hôtel (Marrakech)', 'hotel_pickup', '[{"key":"hotel_name","label":"Hotel Name","label_fr":"Nom de l''hôtel","required":true,"type":"text"},{"key":"hotel_address","label":"Hotel Address","label_fr":"Adresse de l''hôtel","required":true,"type":"text"}]', 150.00, 200.00, 3, 50.00, 'to_driver', '08:00:00', '20:00:00', true, '2025-12-24 14:47:20.354001+00', '2025-12-28 22:36:11.822611+00'),
('e6426dc3-0227-410c-a68f-f76eb9d95d50', 'Train Station Pickup (Marrakech', 'Transfert de la gare (Marrakech', 'train_station_pickup', '[]', 150.00, 200.00, 3, 50.00, 'at_riad', '08:00:00', '20:00:00', true, '2026-01-24 00:32:35.763397+00', '2026-01-24 00:32:35.763397+00'),
('5e808ad9-18a1-482b-9917-a79fbadfaffd', 'Bus Station (Marrakech)', 'Station de Bus (Marrakech)', 'bus_station_pickup', '[]', 200.00, 250.00, 3, 50.00, 'at_riad', '08:00:00', '20:00:00', true, '2026-01-30 21:07:05.769482+00', '2026-01-30 21:07:05.769482+00'),
('4a0835f9-0d42-46e4-869c-fe8391a746d3', 'Airport Pickup', 'Transfert Aéroport', 'airport_pickup', '[{"key":"flight_number","label":"Flight Number","label_fr":"Numéro de vol","required":true,"type":"text"},{"key":"arrival_time","label":"Flight Arrival Time","label_fr":"Heure d''arrivée du vol","required":true,"type":"time"}]', 150.00, 200.00, 3, 50.00, 'to_driver', '08:00:00', '20:00:00', false, '2025-12-24 14:47:20.354001+00', '2025-12-28 21:06:20.185925+00'),
('b2222222-2222-2222-2222-222222222222', 'Casablanca Airport Pickup', 'Transfert Aéroport Casablanca', 'airport_pickup', '[{"key":"flight_number","label":"Flight Number","label_fr":"Numéro de vol","required":true,"type":"text"},{"key":"arrival_time","label":"Flight Arrival Time","label_fr":"Heure d''arrivée du vol","required":true,"type":"time"}]', 180.00, 220.00, 3, 15.00, 'at_riad', '08:00:00', '20:00:00', false, '2025-12-24 15:01:02.768764+00', '2025-12-26 01:08:58.731595+00'),
('ac093e7b-3fdf-4bfd-8e80-23cae39057c5', 'Train Station Pickup', 'Transfert Gare', 'train_station_pickup', '[{"key":"train_number","label":"Train Number","label_fr":"Numéro de train","required":false,"type":"text"},{"key":"arrival_time","label":"Train Arrival Time","label_fr":"Heure d''arrivée du train","required":true,"type":"time"}]', 15.00, 20.00, 3, 3.00, 'at_riad', '08:00:00', '20:00:00', false, '2025-12-24 14:47:20.354001+00', '2025-12-26 01:09:01.979522+00'),
('666e4ddb-5603-42db-bfc0-59de10865b5e', 'Bus Station Pickup', 'Transfert Gare Routière', 'bus_station_pickup', '[{"key":"bus_company","label":"Bus Company","label_fr":"Compagnie de bus","required":false,"type":"text"},{"key":"arrival_time","label":"Bus Arrival Time","label_fr":"Heure d''arrivée du bus","required":true,"type":"time"}]', 12.00, 18.00, 3, 3.00, 'at_riad', '08:00:00', '20:00:00', false, '2025-12-24 14:47:20.354001+00', '2025-12-26 03:22:50.962612+00');
-- ============================================
-- 3. USER_ROLES (14 users)
-- NOTE: user_id references auth.users which is Supabase-managed
-- You'll need to recreate these users in the new Supabase project
-- ============================================
-- Super Admin
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
('0106cb33-7420-44c8-9d27-ee3751b47419', '58273831-9b37-4b82-9ada-64c5abf95997', 'super_admin', '2025-12-26 00:12:41.507726+00');
-- Managers
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
('a27363ce-4597-4619-ae18-55f59fb1f19a', '7c6c5aa5-d396-4457-87b6-f603db33b1ab', 'manager', '2025-12-26 01:09:26.230548+00'),
('116e16da-afd6-41fa-8995-215321011a18', '9fbb860a-d139-4695-b4bd-104d4f85720f', 'manager', '2025-12-29 22:28:41.478999+00'),
('8f1ebcf2-9370-4a6c-90e7-0571402d3af6', 'cd9f8884-16f1-4866-9893-24d2e3b9a3b6', 'manager', '2025-12-30 00:21:42.904541+00'),
('83f22762-d945-4bd6-834e-a09f98ac2001', '99ff9160-69fb-4f1f-985b-0cd6a3f2984d', 'manager', '2026-01-02 01:18:58.132807+00'),
('43c652c8-a9c8-4448-b33e-1e9273c82788', 'b85a7d46-2181-4306-8f03-38aa8e4d4fa8', 'manager', '2026-01-02 01:19:35.077852+00'),
('881779a9-e7e8-4ce4-a350-c4e030fc2134', '7713dfff-31da-42a9-be67-264db3165438', 'manager', '2026-01-05 00:00:52.070129+00'),
('9b44fee1-bc04-4e2b-86d3-21a52a3a337a', '67b1c67b-6b1a-464a-9cde-390b971ecd7c', 'manager', '2026-01-08 15:49:02.274294+00'),
('f888032f-9638-4500-977a-03420cd090ed', 'cf1ff956-415f-4f44-9f63-b295e07db5dd', 'manager', '2026-01-11 20:13:28.878435+00'),
('02be020a-f5ec-4785-96d8-8433ad1299d8', '7e664912-04a3-419a-9e54-435a318d9dff', 'manager', '2026-01-11 21:52:11.393688+00'),
('c2173208-461e-4beb-ae07-daf0f8f652d2', 'b509d8d9-e3f9-4e9f-8934-ab2d0b6d118b', 'manager', '2026-01-12 21:12:40.880657+00'),
('0d2cd319-7436-4739-9c42-fb5adf54f3c6', 'bf62e3b3-9c41-4a66-a63a-4aa8f0310653', 'manager', '2026-01-15 12:41:21.486633+00'),
('b3cafb6f-d52b-445a-b537-022da84008d2', 'a343eea5-0931-4213-a927-71d8c50f19af', 'manager', '2026-01-15 12:42:55.087462+00'),
('5baf8e7f-354e-47b6-b798-fd27cf91fba5', 'a4e316ff-d298-4244-acd1-ecf0044c0221', 'manager', '2026-01-23 11:21:25.927163+00');
-- ============================================
-- 4. PROFILES (14 users)
-- ============================================
INSERT INTO public.profiles (id, user_id, full_name, is_active, created_at, updated_at) VALUES
('c8a0824e-08a8-462e-8cdc-7f972014b89b', '58273831-9b37-4b82-9ada-64c5abf95997', 'Baptiste Parent', true, '2025-12-28 21:31:38.136872+00', '2025-12-28 21:31:38.136872+00'),
('1e689bcd-fa6b-48bf-9b1d-878ff73330dd', '7c6c5aa5-d396-4457-87b6-f603db33b1ab', 'Baptiste Parent', true, '2025-12-26 01:09:26.230548+00', '2025-12-30 00:21:55.903642+00'),
('77b5592e-d092-4063-ac58-90b746e5dc4f', '9fbb860a-d139-4695-b4bd-104d4f85720f', 'Baptiste Parent (Test)', true, '2025-12-29 22:28:41.478999+00', '2025-12-29 23:04:34.050446+00'),
('6b732104-2d3e-4902-b4cb-54de528b6928', 'cd9f8884-16f1-4866-9893-24d2e3b9a3b6', 'Aurore Labat', true, '2025-12-30 00:21:42.904541+00', '2025-12-30 00:21:43.259142+00'),
('06e76fa3-751d-4870-85b8-795f1092bb77', '99ff9160-69fb-4f1f-985b-0cd6a3f2984d', 'Bouchra Marir', true, '2026-01-02 01:18:58.132807+00', '2026-01-02 01:18:58.690834+00'),
('3f2894e0-69e2-4d14-a239-56cdb54ee6c4', 'b85a7d46-2181-4306-8f03-38aa8e4d4fa8', 'Raja Ajal', true, '2026-01-02 01:19:35.077852+00', '2026-01-02 01:19:35.556157+00'),
('88d6eefe-0a20-4af8-94c3-eeda6e0bdca8', '7713dfff-31da-42a9-be67-264db3165438', 'Youssef Bassine', true, '2026-01-05 00:00:52.070129+00', '2026-01-05 00:00:52.411353+00'),
('89e5b72c-d892-41e9-91ad-7d2cd84e3056', '67b1c67b-6b1a-464a-9cde-390b971ecd7c', 'Yassine Afoukal', true, '2026-01-08 15:49:02.274294+00', '2026-01-08 15:49:02.604985+00'),
('0c169318-6e9e-4e50-8f0e-f03dd55a0a7f', 'cf1ff956-415f-4f44-9f63-b295e07db5dd', 'Khadija Ait Elmaki', true, '2026-01-11 20:13:28.878435+00', '2026-01-11 20:13:29.257003+00'),
('2784ec91-fa7b-4a02-b192-8c9f87479877', '7e664912-04a3-419a-9e54-435a318d9dff', 'Julie Costa', true, '2026-01-11 21:52:11.393688+00', '2026-01-15 12:42:05.584819+00'),
('85b2d3fc-ea38-4137-876c-06fe1bc76eef', 'b509d8d9-e3f9-4e9f-8934-ab2d0b6d118b', 'Soukaina Oulghazi', true, '2026-01-12 21:12:40.880657+00', '2026-01-12 21:12:41.268407+00'),
('5f7b5ac9-973e-424e-9ac9-f57852aa2b55', 'bf62e3b3-9c41-4a66-a63a-4aa8f0310653', 'Front Office', true, '2026-01-15 12:41:21.486633+00', '2026-01-15 12:41:21.977921+00'),
('277c548f-148f-47a2-be76-419bc6a3cedb', 'a343eea5-0931-4213-a927-71d8c50f19af', 'Ayoub Bazar', true, '2026-01-15 12:42:55.087462+00', '2026-01-15 12:42:55.374976+00'),
('5f3ae953-56da-44bc-842c-61d917218866', 'a4e316ff-d298-4244-acd1-ecf0044c0221', 'Christine Michel', true, '2026-01-23 11:21:25.927163+00', '2026-01-23 11:21:26.873933+00');
-- ============================================
-- 5. USER_RIADS (15 mappings)
-- ============================================
INSERT INTO public.user_riads (id, user_id, riad_id, created_at) VALUES
('d506fad0-e1cc-46e7-9990-b4f1ae5ca5bd', '7c6c5aa5-d396-4457-87b6-f603db33b1ab', 'a1111111-1111-1111-1111-111111111111', '2025-12-30 00:21:56.036915+00'),
('429bdcaa-bff4-47e6-98eb-2742dbbd7fa3', '9fbb860a-d139-4695-b4bd-104d4f85720f', 'a2222222-2222-2222-2222-222222222222', '2025-12-29 23:04:34.217019+00'),
('c2b805f1-c0b8-42b0-8f64-dcb34b0ba500', '9fbb860a-d139-4695-b4bd-104d4f85720f', 'af039d17-d5d4-476c-ac51-9f83c45bbd19', '2025-12-29 23:04:34.217019+00'),
('092b0936-8e8c-43c2-ba80-98fc35e1ced6', 'cd9f8884-16f1-4866-9893-24d2e3b9a3b6', 'a2222222-2222-2222-2222-222222222222', '2025-12-30 00:21:43.445148+00'),
('181b11c1-bdd8-4026-a1a4-a451bd77316c', 'cd9f8884-16f1-4866-9893-24d2e3b9a3b6', 'af039d17-d5d4-476c-ac51-9f83c45bbd19', '2025-12-30 00:21:43.445148+00'),
('c5204f8c-54ad-48a7-b83f-0dd9acbb1f43', '99ff9160-69fb-4f1f-985b-0cd6a3f2984d', 'afc6c2d4-cfd9-45b9-b164-32f2b933b385', '2026-01-02 01:18:58.85647+00'),
('97ac408f-8c98-4e05-9fe8-bcd6397b54bf', 'b85a7d46-2181-4306-8f03-38aa8e4d4fa8', '92d7c9dd-42d5-4624-ad02-c2ad55f77fff', '2026-01-02 01:19:35.671973+00'),
('74abc667-b501-45ae-a418-d1b0d2249b88', '7713dfff-31da-42a9-be67-264db3165438', '53a65316-b80a-4683-85ed-f0e7455d12b3', '2026-01-05 00:00:52.612658+00'),
('0182ecad-e20e-4a1b-b321-0bc40afb13ec', '67b1c67b-6b1a-464a-9cde-390b971ecd7c', 'b68d8c26-cf61-4598-a327-9437facc7611', '2026-01-08 15:49:02.804803+00'),
('a757d432-9e12-4f15-8991-25e8691fa75e', 'cf1ff956-415f-4f44-9f63-b295e07db5dd', 'b4fd95f6-2d25-4691-a1a9-088d02314be5', '2026-01-11 20:13:29.474591+00'),
('488e9168-244a-4b18-a323-aa315c19bcd8', '7e664912-04a3-419a-9e54-435a318d9dff', '04827b81-ae72-4dc7-87db-7885c77e56ea', '2026-01-15 12:42:05.808576+00'),
('94048c0c-7b26-461d-aedb-554ea292d29a', 'b509d8d9-e3f9-4e9f-8934-ab2d0b6d118b', '866ab142-bdf6-4d75-93b9-5b59e06c93e0', '2026-01-12 21:12:41.449547+00'),
('0821625f-7900-49e9-8376-2d9ae55fcd68', 'bf62e3b3-9c41-4a66-a63a-4aa8f0310653', '08c11cb8-33a9-435a-8fa0-12269eba032e', '2026-01-15 12:41:22.43403+00'),
('d84d1bc5-d191-4685-a235-f3cbf5bc1081', 'a343eea5-0931-4213-a927-71d8c50f19af', '04827b81-ae72-4dc7-87db-7885c77e56ea', '2026-01-15 12:42:55.575012+00'),
('0677c75d-643a-45b2-9e13-1bc7dca6e7f2', 'a4e316ff-d298-4244-acd1-ecf0044c0221', '7292fa33-a136-4685-b0fe-76dbe5a8f465', '2026-01-23 11:21:27.179748+00');
-- ============================================
-- 6. RESERVATIONS & TRANSPORT_REQUESTS
-- NOTE: Due to size, these are provided as separate files
-- Run 004a_reservations.sql and 004b_transport_requests.sql
-- ============================================
-- For complete reservations data, please run:
-- SELECT * FROM reservations ORDER BY created_at;
-- And generate INSERT statements from the output
-- For complete transport_requests data, please run:
-- SELECT * FROM transport_requests ORDER BY created_at;
-- And generate INSERT statements from the output
-- ============================================
-- 7. POST-MIGRATION: AUTH TRIGGER
-- ============================================
-- Run this AFTER importing data to set up the auth trigger:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user_role();