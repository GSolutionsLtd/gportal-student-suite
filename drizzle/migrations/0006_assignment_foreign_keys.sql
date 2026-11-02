ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) NOT VALID,
  ADD CONSTRAINT assignments_class_arm_id_fkey FOREIGN KEY (class_arm_id) REFERENCES public.class_arms(id) NOT VALID,
  ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) NOT VALID,
  ADD CONSTRAINT assignments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.academic_sessions(id) NOT VALID,
  ADD CONSTRAINT assignments_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id) NOT VALID;
ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) NOT VALID;
NOTIFY pgrst, 'reload schema';