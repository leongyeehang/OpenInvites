-- Postgres 18 is the minimum: every table relies on the native uuidv7() function (ADR-0004).
-- Failing here, on first start, gives the operator a clear message instead of a broken table later.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 180000 THEN
    RAISE EXCEPTION 'OpenInvites requires Postgres 18 or newer, found %', current_setting('server_version');
  END IF;
END
$$;
