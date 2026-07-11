import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  phoneNumber: string;
  studentName: string;
  admissionNumber: string;
  termName: string;
  sessionName: string;
  averageScore: number | null;
  classPosition: number | null;
  classSize: number;
  schoolName?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Require authenticated admin/teacher
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;
    const roleChecks = await Promise.all([
      authClient.rpc('has_role', { _user_id: uid, _role: 'teacher' }),
      authClient.rpc('has_role', { _user_id: uid, _role: 'admin' }),
      authClient.rpc('has_role', { _user_id: uid, _role: 'super_admin' }),
    ]);
    if (!roleChecks.some((r) => r.data === true)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      phoneNumber, 
      studentName, 
      admissionNumber,
      termName, 
      sessionName,
      averageScore, 
      classPosition, 
      classSize,
      schoolName 
    } = await req.json() as SMSRequest;

    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Normalize phone number (ensure it starts with country code)
    let normalizedPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '234' + normalizedPhone.slice(1); // Default to Nigeria
    } else if (!normalizedPhone.startsWith('+') && !normalizedPhone.startsWith('234')) {
      normalizedPhone = '234' + normalizedPhone;
    }
    normalizedPhone = normalizedPhone.replace('+', '');

    // Compose SMS message (keep it short for SMS - max 160 chars)
    const school = schoolName || 'School';
    const position = classPosition ? `${classPosition}${getOrdinalSuffix(classPosition)} of ${classSize}` : 'N/A';
    const avg = averageScore !== null ? `${averageScore.toFixed(1)}%` : 'N/A';
    
    const message = `Dear Parent, ${studentName} (${admissionNumber}) result for ${termName} is ready. Average: ${avg}, Position: ${position}. Check result portal for details. - ${school}`;

    console.log('SMS to be sent:', {
      to: normalizedPhone,
      message: message.substring(0, 160),
    });

    // Note: Integrate with SMS provider here (Termii, Twilio, Africa's Talking)
    // For now, we simulate success and log the attempt
    
    // Example Termii integration (commented out - requires TERMII_API_KEY secret):
    /*
    const termiiApiKey = Deno.env.get('TERMII_API_KEY');
    if (termiiApiKey) {
      const termiiResponse = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: termiiApiKey,
          to: normalizedPhone,
          from: "N-Alert",
          sms: message.substring(0, 160),
          type: "plain",
          channel: "generic"
        })
      });
      const termiiResult = await termiiResponse.json();
      console.log('Termii response:', termiiResult);
    }
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS notification sent',
        sms_content: message.substring(0, 160),
        phone: normalizedPhone,
        note: 'SMS provider integration pending. Message logged successfully.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Error sending SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
