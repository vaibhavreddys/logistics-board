-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_person text,
  contact_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.indent_status_history (
  id bigint NOT NULL DEFAULT nextval('indent_status_history_id_seq'::regclass),
  indent_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  remark text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  from_status USER-DEFINED,
  to_status USER-DEFINED,
  CONSTRAINT indent_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT indent_status_history_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id),
  CONSTRAINT indent_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.indents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  created_by uuid NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  vehicle_type text NOT NULL,
  trip_cost numeric,
  tat_hours integer,
  load_material text,
  load_weight_kg real,
  pickup_at timestamp with time zone NOT NULL,
  contact_phone text NOT NULL,
  notes text,
  selected_truck_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  vehicle_number text,
  driver_phone text,
  trip_id uuid,
  status USER-DEFINED,
  client_cost numeric DEFAULT 0,
  short_id character varying,
  CONSTRAINT indents_pkey PRIMARY KEY (id),
  CONSTRAINT indents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT indents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT indents_selected_truck_id_fkey FOREIGN KEY (selected_truck_id) REFERENCES public.trucks(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.trip_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL UNIQUE,
  trip_cost numeric NOT NULL,
  advance_payment numeric DEFAULT 0.00,
  toll_charges numeric DEFAULT 0.00,
  halting_charges numeric DEFAULT 0.00,
  traffic_fines numeric DEFAULT 0.00,
  handling_charges numeric DEFAULT 0.00,
  platform_fees numeric DEFAULT 0.00,
  platform_fines numeric DEFAULT 0.00,
  payment_status USER-DEFINED NOT NULL DEFAULT 'Pending'::payment_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  final_payment numeric DEFAULT 0.00 CHECK (final_payment >= 0::numeric),
  client_cost numeric,
  trip_profit numeric,
  CONSTRAINT trip_payments_pkey PRIMARY KEY (id),
  CONSTRAINT trip_payments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);
CREATE TABLE public.trip_status_history (
  id bigint NOT NULL DEFAULT nextval('trip_status_history_id_seq'::regclass),
  trip_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  remark text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  from_status USER-DEFINED,
  to_status USER-DEFINED,
  CONSTRAINT trip_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT trip_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.trips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  indent_id uuid NOT NULL,
  truck_id uuid,
  driver_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'created'::trip_status,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  current_location text,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  short_id text DEFAULT lpad((nextval('trips_short_id_seq'::regclass))::text, 5, '0'::text) UNIQUE,
  trip_cost numeric DEFAULT 0,
  client_cost numeric DEFAULT 0,
  truck_provider_id uuid,
  driver_phone numeric,
  CONSTRAINT trips_pkey PRIMARY KEY (id),
  CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id),
  CONSTRAINT trips_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id),
  CONSTRAINT trips_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES public.trucks(id),
  CONSTRAINT trips_truck_provider_id_fkey FOREIGN KEY (truck_provider_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.truck_owners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  aadhaar_or_pan text NOT NULL CHECK (aadhaar_or_pan ~ '^[A-Z0-9]{10}$|^[0-9]{12}$'::text),
  bank_account_number text,
  bank_ifsc_code text CHECK (bank_ifsc_code IS NULL OR bank_ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'::text),
  upi_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  town_city text,
  CONSTRAINT truck_owners_pkey PRIMARY KEY (id),
  CONSTRAINT truck_owners_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.trucks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text NOT NULL,
  capacity_kg double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT trucks_pkey PRIMARY KEY (id),
  CONSTRAINT trucks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);