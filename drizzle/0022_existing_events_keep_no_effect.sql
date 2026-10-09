-- The upgrade to 0.3 changes nothing on a live page until its host chooses (spec, story 141). Every
-- event before 0.3 stored its template's effect, Birthday's sparkles among them, which nothing drew;
-- from 0.3 effects are drawn, so every event that exists now is set to no effect. Its theme no
-- longer matches its template, so the template is marked changed and the Design drawer reads
-- "custom, started from" it. An event already at no effect is left as it is: nothing on its page
-- would move, and a Quiet or Supper club theme still matches its template. The host picks an
-- effect, or applies the template again, in the Design drawer.
UPDATE "event"
SET "theme" = CASE
  WHEN jsonb_typeof("theme" -> 'template') = 'object'
    THEN jsonb_set(jsonb_set("theme", '{effect}', '"none"'), '{template,dirty}', 'true')
  ELSE jsonb_set("theme", '{effect}', '"none"')
END
WHERE "theme" ->> 'effect' IS DISTINCT FROM 'none';
