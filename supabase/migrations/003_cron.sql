-- Sjálfvirk verk (Supabase: Database → Extensions → kveikja á pg_cron fyrst)
create extension if not exists pg_cron;

select cron.schedule('box800-bua-til-tima', '15 3 * * *', $$select public.generate_classes(28)$$);
select cron.schedule('box800-aflysa-faa', '*/5 * * * *', $$select public.auto_cancel_low()$$);
