CREATE UNIQUE INDEX IF NOT EXISTS artifacts_content_path_uq
ON artifacts(content_item_id, path);
