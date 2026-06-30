DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'salon') THEN
    CREATE ROLE salon WITH LOGIN PASSWORD 'salon' CREATEDB;
  END IF;
END $$;

CREATE DATABASE salon_pos OWNER salon;

GRANT ALL PRIVILEGES ON DATABASE salon_pos TO salon;