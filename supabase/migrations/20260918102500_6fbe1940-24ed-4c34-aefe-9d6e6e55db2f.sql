GRANT SELECT ON public.counselor_wallet_entries TO authenticated;
GRANT ALL ON public.counselor_wallet_entries TO service_role;

GRANT SELECT ON public.counselor_payouts TO authenticated;
GRANT ALL ON public.counselor_payouts TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.counselor_profiles TO authenticated;
GRANT ALL ON public.counselor_profiles TO service_role;

GRANT SELECT, INSERT ON public.counselor_session_ratings TO authenticated;
GRANT ALL ON public.counselor_session_ratings TO service_role;