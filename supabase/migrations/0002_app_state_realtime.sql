alter table public.app_state add column client_id text;

alter publication supabase_realtime add table public.app_state;
