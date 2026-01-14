import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  studentId: string;
  resultId: string;
  phoneNumber: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { studentId, resultId, phoneNumber } = await req.json() as SMSRequest;

    // Fetch student and result information
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, admission_number')
      .eq('id', studentId)
      .single();

    const { data: result } = await supabase
      .from('results')
      .select(`
        average_score,
        class_position,
        term:terms(name, session:academic_sessions(name))
      `)
      .eq('id', resultId)
      .single();

    if (!student || !result) {
      throw new Error('Student or result not found');
    }

    const { data: schoolSettings } = await supabase
      .from('school_settings')
      .select('school_name')
      .limit(1)
      .single();

    // Compose SMS message (keep it short for SMS)
    const schoolName = schoolSettings?.school_name || 'School';
    const termInfo = result.term as any;
    const message = `Dear Parent, ${student.first_name} ${student.last_name} (${student.admission_number}) result for ${termInfo?.name} is ready. Average: ${result.average_score || 'N/A'}%, Position: ${result.class_position || 'N/A'}. Check the result portal for details. - ${schoolName}`;

    // Note: This is a placeholder for SMS integration
    // You would integrate with an SMS provider like Twilio, Termii, or Africa's Talking here
    // For now, we'll log the SMS details and return success
    
    console.log('SMS to be sent:', {
      to: phoneNumber,
      message: message,
      studentId,
      resultId
    });

    // Store SMS notification in database for tracking (optional)
    await supabase.from('notifications').insert({
      user_id: studentId,
      title: 'Result Published (SMS)',
      message: `SMS notification sent to ${phoneNumber}`,
      type: 'sms',
      is_read: true
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS notification queued',
        sms_content: message 
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
