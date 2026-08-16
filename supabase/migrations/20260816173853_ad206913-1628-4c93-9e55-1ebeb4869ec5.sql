REVOKE ALL ON FUNCTION public.request_counselor_payout() FROM anon;
REVOKE ALL ON FUNCTION public.request_counselor_payout() FROM public;
GRANT EXECUTE ON FUNCTION public.request_counselor_payout() TO authenticated;