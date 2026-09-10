-- 0026_raise_image_upload_limits.sql
-- Raise existing private image buckets from 5 MiB to 15 MiB.
-- MIME allowlists, privacy, paths, and object policies remain unchanged.

update storage.buckets
set file_size_limit = 15728640
where id in ('avatars', 'pet-photos');

-- Rollback: set file_size_limit back to 5242880 for these two bucket ids.
