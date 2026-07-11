import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentPerformance {
  studentName: string;
  averageScore: number;
  position: number;
  classSize: number;
  subjectCount: number;
  termName: string;
  className: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { performance, remarkType } = await req.json() as { 
      performance: StudentPerformance; 
      remarkType: 'class_teacher' | 'principal' 
    };

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const positionSuffix = getOrdinalSuffix(performance.position);
    const performanceLevel = getPerformanceLevel(performance.averageScore);
    
    const systemPrompt = remarkType === 'class_teacher' 
      ? `You are a caring and supportive class teacher writing a brief remark about a student's academic performance. 
         Keep the remark professional, encouraging, and constructive. Maximum 2 sentences.
         Focus on the student's effort and potential for improvement.`
      : `You are a school principal writing a formal but encouraging remark about a student's academic performance.
         Keep the remark brief, dignified, and motivating. Maximum 2 sentences.
         Acknowledge achievement while encouraging continued effort.`;

    const userPrompt = `Write a ${remarkType === 'class_teacher' ? 'class teacher' : 'principal'} remark for:
Student: ${performance.studentName}
Average Score: ${performance.averageScore}%
Class Position: ${performance.position}${positionSuffix} out of ${performance.classSize} students
Term: ${performance.termName}
Class: ${performance.className}
Performance Level: ${performanceLevel}
Subjects Taken: ${performance.subjectCount}

Generate a personalized, appropriate remark.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const remark = data.choices?.[0]?.message?.content?.trim() || getDefaultRemark(performanceLevel, remarkType);

    return new Response(
      JSON.stringify({ remark }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Error generating remark:', error);
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

function getPerformanceLevel(average: number): string {
  if (average >= 70) return 'Excellent';
  if (average >= 60) return 'Very Good';
  if (average >= 50) return 'Good';
  if (average >= 40) return 'Fair';
  return 'Needs Improvement';
}

type PerformanceLevel = 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Needs Improvement';
type RemarkType = 'class_teacher' | 'principal';

function getDefaultRemark(level: string, type: RemarkType): string {
  const remarks: Record<RemarkType, Record<PerformanceLevel, string>> = {
    class_teacher: {
      'Excellent': 'Outstanding performance! Keep up the excellent work.',
      'Very Good': 'Very good performance. Continue to strive for excellence.',
      'Good': 'Good effort. With more dedication, you can achieve even better results.',
      'Fair': 'Fair performance. More effort and focus is needed.',
      'Needs Improvement': 'You need to put in more effort. Seek help when needed.'
    },
    principal: {
      'Excellent': 'Congratulations on your excellent academic achievement. Keep excelling.',
      'Very Good': 'Commendable performance. Continue to work hard.',
      'Good': 'Satisfactory performance. Aim higher next term.',
      'Fair': 'More effort is required to improve your standing.',
      'Needs Improvement': 'Significant improvement is needed. We believe in your potential.'
    }
  };
  const performanceLevel = level as PerformanceLevel;
  return remarks[type][performanceLevel] || 'Keep working hard.';
}