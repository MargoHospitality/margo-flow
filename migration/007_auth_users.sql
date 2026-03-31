-- =============================================================
-- auth.users EXPORT - Margo Flow Migration
-- Generated: 2026-02-06
-- Total users: 14 (9 confirmed, 5 pending)
-- =============================================================
-- 
-- IMPORTANT: This file contains sensitive data (password hashes)
-- Run this in your NEW Supabase project's SQL Editor
-- You may need superuser privileges to insert into auth.users
-- =============================================================

-- User 1: Super Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '58273831-9b37-4b82-9ada-64c5abf95997',
  'baptiste@margo-hospitality.com',
  '$2a$10$/HDUZgtfL/OFEhUsJXezHeF8EftJ3XQbiNfYeUn4XM3Cqbd/J8tXa',
  '2025-12-26 00:12:41.695913+00',
  '2025-12-26 00:12:41.510649+00',
  '2026-02-06 17:51:37.347261+00',
  '{"email":"baptiste@margo-hospitality.com","email_verified":true,"phone_verified":false,"sub":"58273831-9b37-4b82-9ada-64c5abf95997"}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 2: Riad Massiba
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '7c6c5aa5-d396-4457-87b6-f603db33b1ab',
  'booking@riadmassiba-marrakech.net',
  '$2a$10$75or8yAa9oYYpZ5eiFC7/eNyoHeHiUszDtwtaZmjCl1fBGUVyibIe',
  '2025-12-26 01:09:58.880898+00',
  '2025-12-26 01:09:26.232216+00',
  '2025-12-26 01:09:58.893152+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 3: Baptiste Parent
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '9fbb860a-d139-4695-b4bd-104d4f85720f',
  'baptiste.parent@gmail.com',
  '$2a$10$Bddjx6BOc5dxkVZxMsF4R.nVs./PZNcVuczkG/qfRxYeeS9LYJL16',
  '2025-12-29 22:56:43.39783+00',
  '2025-12-29 22:28:41.480409+00',
  '2025-12-29 23:49:30.290287+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 4: Riad Dar Coram
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'cd9f8884-16f1-4866-9893-24d2e3b9a3b6',
  'riaddarcoram@gmail.com',
  '$2a$10$o5AmZLTdRiLoiwqnoj4M3Odhv5aO9S/DR0jss5NFZSkcZ0/WfLFY2',
  '2025-12-30 00:37:18.613798+00',
  '2025-12-30 00:21:42.909786+00',
  '2026-02-05 21:19:58.784591+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 5: Riad Samsara
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '99ff9160-69fb-4f1f-985b-0cd6a3f2984d',
  'bouchra@riad-samsara.net',
  '$2a$10$Be9sZBtmczgQW3Xjd7WJy.db/STV60zWpSX8a5n78RVmC4jsYQ4n2',
  '2026-01-05 11:03:21.145411+00',
  '2026-01-02 01:18:58.133115+00',
  '2026-02-06 12:58:07.234494+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 6: Ajal Raja
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'b85a7d46-2181-4306-8f03-38aa8e4d4fa8',
  'ajal.raja9@gmail.com',
  '$2a$10$TCfY0NUHD7qmiUUhwTiDeeaAG6LH0IAOSUOkya9K.amr0jj7SAqvO',
  '2026-01-10 15:42:45.27215+00',
  '2026-01-02 01:19:35.078126+00',
  '2026-02-06 14:05:20.532107+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 7: Palazzo Montefiore
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '7713dfff-31da-42a9-be67-264db3165438',
  'palazzomontefiore@gmail.com',
  '$2a$10$6c2KThML/ZppaZcguTDUNOALox47nppR0UIRaNGE/fnFxulsXg5PC',
  '2026-01-05 10:53:55.233761+00',
  '2026-01-05 00:00:52.071031+00',
  '2026-02-06 16:49:00.781717+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 8: Riad Bindoo
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '67b1c67b-6b1a-464a-9cde-390b971ecd7c',
  'riadbindoo@gmail.com',
  '$2a$10$hEk5AdeUXkF5B775RTL.VufABArzifVjMEUjOCz./PL6JsVMjvzfy',
  '2026-01-08 15:53:37.744831+00',
  '2026-01-08 15:49:02.275758+00',
  '2026-01-22 13:05:44.560053+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 9: L'Esprit des Patios
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'cf1ff956-415f-4f44-9f63-b295e07db5dd',
  'lespritdespatiosriad@gmail.com',
  '$2a$10$93OpCMUaQ6DjFoKw3IleaOzjrUxXbVE1A.NiWIwe2.YLzih1KtuCq',
  '2026-01-11 20:21:02.174881+00',
  '2026-01-11 20:13:28.880917+00',
  '2026-01-23 13:31:46.902852+00',
  '{"email_verified":true}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- =============================================================
-- UNCONFIRMED USERS (email not verified, no password)
-- These users never completed registration - optional to import
-- =============================================================

-- User 10: Le Riad Amour (unconfirmed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  '7e664912-04a3-419a-9e54-435a318d9dff',
  'leriadamour@gmail.com',
  '',
  NULL,
  '2026-01-11 21:52:11.396483+00',
  '2026-01-11 21:52:11.478682+00',
  '{}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 11: Jowairiya (unconfirmed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'b509d8d9-e3f9-4e9f-8934-ab2d0b6d118b',
  'jowairiyael2020@gmail.com',
  '',
  NULL,
  '2026-01-12 21:12:40.88156+00',
  '2026-01-12 21:12:40.953136+00',
  '{}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 12: Riad Elisa (unconfirmed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'bf62e3b3-9c41-4a66-a63a-4aa8f0310653',
  'info@riad-elisa.com',
  '',
  NULL,
  '2026-01-15 12:41:21.490691+00',
  '2026-01-15 12:41:21.673688+00',
  '{}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 13: Ayoub Zaad (unconfirmed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'a343eea5-0931-4213-a927-71d8c50f19af',
  'ayoubzaad20@gmail.com',
  '',
  NULL,
  '2026-01-15 12:42:55.087756+00',
  '2026-01-15 12:42:55.095752+00',
  '{}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);

-- User 14: Riad Ayadina (unconfirmed)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, instance_id, aud, role)
VALUES (
  'a4e316ff-d298-4244-acd1-ecf0044c0221',
  'inforiadayadina@gmail.com',
  '',
  NULL,
  '2026-01-23 11:21:25.930122+00',
  '2026-01-23 11:21:25.930122+00',
  '{}',
  '{"provider":"email","providers":["email"]}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
);
