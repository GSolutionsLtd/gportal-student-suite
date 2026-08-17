delete from public.counselor_wallet_entries where counselor_user_id = 'e0447bce-c139-455d-9c20-46bd69263102';
delete from public.career_counseling_sessions where subscriber_user_id = '0d5b1b3c-9195-4979-acce-8e4426c65280';
delete from public.careeraid_subscriptions where user_id = '0d5b1b3c-9195-4979-acce-8e4426c65280';
delete from public.user_roles where user_id = 'e0447bce-c139-455d-9c20-46bd69263102';
update public.profiles set is_active = false where id in ('e0447bce-c139-455d-9c20-46bd69263102','0d5b1b3c-9195-4979-acce-8e4426c65280');