update public.careeraid_subscriptions
set status='active', starts_at=now(), expires_at=now()+interval '1 year'
where user_id='0d5b1b3c-9195-4979-acce-8e4426c65280';