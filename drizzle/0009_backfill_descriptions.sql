UPDATE "event"
SET "description_rich" = jsonb_build_object(
  'blocks',
  (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('type', 'paragraph', 'spans', jsonb_build_array(jsonb_build_object('text', line)))
        ORDER BY ordinality
      ),
      '[]'::jsonb
    )
    FROM regexp_split_to_table("event"."description", E'\n') WITH ORDINALITY AS split(line, ordinality)
    WHERE btrim(line) <> ''
  )
)
WHERE "description" <> '' AND "description_rich" -> 'blocks' = '[]'::jsonb;
