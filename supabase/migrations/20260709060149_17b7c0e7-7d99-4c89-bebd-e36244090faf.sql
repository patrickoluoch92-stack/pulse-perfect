
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('subscription-renewals-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'subscription-renewals-daily');

SELECT cron.schedule(
  'subscription-renewals-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--61266718-973b-43aa-9dae-25edfc6e25d2.lovable.app/api/public/hooks/subscription-renewals',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveW5ndnV5ZWtycm92ZWh6dG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjMxMzYsImV4cCI6MjA5NjQ5OTEzNn0.L-D3a9CGbMPwKx4cX89oTsWLbbvd0qs0q4O2zigRQ0I"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
