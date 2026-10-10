-- La lista se accede sólo a través de la API y sus tokens de participante.
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ChecklistItem" FROM PUBLIC;

-- Supabase tiene estos roles; otras instalaciones de PostgreSQL pueden no tenerlos.
DO $$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE "ChecklistItem" FROM %I', client_role);
  END LOOP;
END $$;
