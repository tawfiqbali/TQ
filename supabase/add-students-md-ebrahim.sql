-- =====================================================================
-- QIT: add 9 students to teacher Md. Ebrahim
-- How to use: Supabase -> SQL Editor -> New query -> paste ALL of this -> Run.
--
-- - Finds Md. Ebrahim in the Teachers List by name (titles like "Md." are
--   ignored). If no teacher or more than one teacher matches, nothing is added
--   and a message says so: then put his Teacher ID on the line marked
--   "<-- Teacher ID" (e.g. 'QIT-015') and run again.
-- - Each student gets the next student ID (QIT-S###). Monthly fee and share
--   start at 0 (set them later in Students / Salary Directory).
-- - SAFE TO RUN AGAIN: a student already under Md. Ebrahim with the same name
--   is not added twice. Usman Ghani and Ryan share one number and stay two
--   separate students.
-- - They appear everywhere at once: Management Portal, Md. Ebrahim's Teacher
--   Dashboard (My Students, Attendance, Monthly Report).
-- =====================================================================
do $qitadd$
declare
  v_teacher_id text := '';   -- <-- Teacher ID, only if the name search can't find him
  v_matches text;
  v_count int;
  v_tid text;
  v_name text;
  v_added int := 0;
  v_skipped int := 0;
  s jsonb;
  n int;
  sid text;
begin
  if coalesce(trim(v_teacher_id), '') <> '' then
    select id, data ->> 'name' into v_tid, v_name from public.portal_teachers where upper(id) = upper(trim(v_teacher_id));
    if v_tid is null then raise exception 'No teacher with the ID % in the Teachers List.', v_teacher_id; end if;
  else
    select count(*), string_agg(id || ' ' || coalesce(data ->> 'name', ''), ', ')
      into v_count, v_matches
      from public.portal_teachers
      where public.norm_name(data ->> 'name') ~ '(^| )(ebrahim|ebrahem|ebraheem|ibrahim|ibraheem)( |$)';
    if v_count = 0 then
      raise exception 'No teacher named Ebrahim found. Type his Teacher ID on the "<-- Teacher ID" line and run again.';
    elsif v_count > 1 then
      raise exception 'More than one teacher matches "Ebrahim": %. Type the right Teacher ID on the "<-- Teacher ID" line and run again.', v_matches;
    end if;
    select id, data ->> 'name' into v_tid, v_name from public.portal_teachers
      where public.norm_name(data ->> 'name') ~ '(^| )(ebrahim|ebrahem|ebraheem|ibrahim|ibraheem)( |$)';
  end if;

  for s in select * from jsonb_array_elements($qit$[
    {"name": "Md Anas",      "phone": "+61 430 647 803"},
    {"name": "Abdullah",     "phone": "+65 8287 2935"},
    {"name": "Mahir",        "phone": "+82 10-5944-3722"},
    {"name": "Usman Ghani",  "phone": "+61 450 633 595"},
    {"name": "Ryan",         "phone": "+61 450 633 595"},
    {"name": "Lemon",        "phone": "+82 10-2596-5446"},
    {"name": "Saidul Islam", "phone": "+82 10-7647-4036"},
    {"name": "Kasem",        "phone": "+82 10-3293-7786"},
    {"name": "Saiful Islam", "phone": "+60 11-1433 8865"}
  ]$qit$::jsonb)
  loop
    if exists (select 1 from public.portal_students p
               where p.teacher_id = v_tid and public.norm_name(p.data ->> 'name') = public.norm_name(s ->> 'name')) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    n := public.next_portal_number('portal_students', 'QIT-S');
    sid := 'QIT-S' || lpad(n::text, 3, '0');
    insert into public.portal_students (id, data) values (sid, jsonb_build_object(
      'id', sid, 'name', s ->> 'name', 'phone', s ->> 'phone', 'teacherId', v_tid,
      'fee', 0, 'cut', 0, 'course', 'Quran & Tajweed', 'status', 'Active', 'classTime', '',
      'addedAt', now()));
    v_added := v_added + 1;
  end loop;

  raise notice 'Teacher: % (%) — % student(s) added, % already there.', v_name, v_tid, v_added, v_skipped;
end
$qitadd$;

-- The list of Md. Ebrahim's students after the import
select s.id as student_id, s.data ->> 'name' as student, s.data ->> 'phone' as whatsapp,
       t.id as teacher_id, t.data ->> 'name' as teacher
from public.portal_students s
join public.portal_teachers t on t.id = s.teacher_id
where public.norm_name(t.data ->> 'name') ~ '(^| )(ebrahim|ebrahem|ebraheem|ibrahim|ibraheem)( |$)'
order by s.id;
