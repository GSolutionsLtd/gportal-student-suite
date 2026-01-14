-- Add signature fields to school_settings for Principal
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS principal_signature_url text,
ADD COLUMN IF NOT EXISTS principal_name text;

-- Add signature fields to teachers for Class/Form teachers
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS is_class_teacher boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_form_teacher boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS signature_url text;

-- Add teacher remarks fields to results
ALTER TABLE public.results 
ADD COLUMN IF NOT EXISTS class_teacher_remark text,
ADD COLUMN IF NOT EXISTS principal_remark text,
ADD COLUMN IF NOT EXISTS class_teacher_id uuid REFERENCES public.teachers(id);

-- Add weighted_score column if missing
ALTER TABLE public.result_components 
ADD COLUMN IF NOT EXISTS weighted_score numeric;

-- Create function to compute result aggregates
CREATE OR REPLACE FUNCTION compute_result_aggregates(p_result_id uuid)
RETURNS void AS $$
DECLARE
    v_total_score numeric;
    v_average_score numeric;
    v_subject_count integer;
BEGIN
    -- Calculate aggregates from result_components
    SELECT 
        COALESCE(SUM(total_score), 0),
        COALESCE(AVG(total_score), 0),
        COUNT(*)
    INTO v_total_score, v_average_score, v_subject_count
    FROM result_components
    WHERE result_id = p_result_id AND total_score IS NOT NULL;

    -- Update the result
    UPDATE results
    SET 
        total_score = v_total_score,
        average_score = ROUND(v_average_score, 2)
    WHERE id = p_result_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to compute class positions for a term and class arm
CREATE OR REPLACE FUNCTION compute_class_positions(p_term_id uuid, p_class_arm_id uuid)
RETURNS void AS $$
BEGIN
    -- Update positions based on average_score ranking
    WITH ranked AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY average_score DESC NULLS LAST) as position
        FROM results
        WHERE term_id = p_term_id 
          AND class_arm_id = p_class_arm_id
          AND average_score IS NOT NULL
    )
    UPDATE results r
    SET class_position = ranked.position
    FROM ranked
    WHERE r.id = ranked.id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to get grade for a score
CREATE OR REPLACE FUNCTION get_grade_for_score(p_score numeric)
RETURNS TABLE(grade text, remark text) AS $$
BEGIN
    RETURN QUERY
    SELECT gs.grade, gs.remark
    FROM grading_scales gs
    WHERE p_score >= gs.min_score AND p_score <= gs.max_score
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SET search_path = public;