-- StyleDesk AI — F4 + F5: endurecimento de segurança
-- ---------------------------------------------------------------------------
-- F4: remove privilégios amplos e desnecessários de anon/authenticated
-- (TRUNCATE/REFERENCES/TRIGGER não são expostos pela API, mas é defense-in-depth).
-- F5: limita tamanho e tipos de arquivo por bucket (reforço server-side, além
-- da validação do cliente). Idempotente.
-- ---------------------------------------------------------------------------

-- F4
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- F5 (10 MB; tipos de imagem comuns, incluindo HEIC/HEIF de iPhone)
update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp',
        'image/heic', 'image/heif', 'image/gif'
      ]
  where id in ('catalog', 'clients', 'generated', 'presets');
