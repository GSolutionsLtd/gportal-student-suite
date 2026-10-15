CREATE OR REPLACE FUNCTION public.sync_cbt_score(_student_id uuid, _term_id uuid, _class_arm_id uuid, _subject_id uuid, _field text, _percentage numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_school uuid; v_result uuid; v_status text; v_max numeric; v_val numeric;
BEGIN
  IF _field NOT IN ('test1','test2','other','exam') THEN RAISE EXCEPTION 'Invalid score field'; END IF;
  SELECT school_id INTO v_school FROM public.students WHERE id = _student_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF NOT (public.is_school_admin(auth.uid(), v_school) OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Only the school admin can sync CBT scores';
  END IF;
  v_max := CASE WHEN _field = 'exam' THEN 70 ELSE 10 END;
  v_val := round(LEAST(100, GREATEST(0, COALESCE(_percentage,0))) * v_max / 100, 1);

  INSERT INTO public.results (student_id, term_id, class_arm_id, status, school_id)
  VALUES (_student_id, _term_id, _class_arm_id, 'draft', v_school)
  ON CONFLICT (student_id, term_id) DO NOTHING;
  SELECT id, status::text INTO v_result, v_status FROM public.results
  WHERE student_id = _student_id AND term_id = _term_id FOR UPDATE;
  IF v_status = 'published' THEN RAISE EXCEPTION 'Result already published; reset it first'; END IF;

  INSERT INTO public.result_components (result_id, subject_id, test1_score, test2_score, other_assessment_score, exam_score, entered_by, entered_at, school_id)
  VALUES (v_result, _subject_id,
    CASE WHEN _field='test1' THEN v_val END, CASE WHEN _field='test2' THEN v_val END,
    CASE WHEN _field='other' THEN v_val END, CASE WHEN _field='exam' THEN v_val END,
    auth.uid(), now(), v_school)
  ON CONFLICT (result_id, subject_id) DO UPDATE SET
    test1_score = CASE WHEN _field='test1' THEN v_val ELSE result_components.test1_score END,
    test2_score = CASE WHEN _field='test2' THEN v_val ELSE result_components.test2_score END,
    other_assessment_score = CASE WHEN _field='other' THEN v_val ELSE result_components.other_assessment_score END,
    exam_score = CASE WHEN _field='exam' THEN v_val ELSE result_components.exam_score END,
    entered_by = auth.uid(), entered_at = now();

  UPDATE public.result_components SET total_score =
    COALESCE(test1_score,0)+COALESCE(test2_score,0)+COALESCE(other_assessment_score,0)+COALESCE(exam_score,0)
  WHERE result_id = v_result AND subject_id = _subject_id;
  RETURN v_val;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_cbt_score(uuid,uuid,uuid,uuid,text,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_cbt_score(uuid,uuid,uuid,uuid,text,numeric) TO authenticated;