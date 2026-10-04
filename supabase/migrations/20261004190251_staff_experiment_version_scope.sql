CREATE OR REPLACE FUNCTION private.staff_experiment_versions()
RETURNS TABLE(id text,lab_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
select p.id,e.lab_version from private.staff_experiment_progress_rows() p
join public.experiments e on e.id=p.id where auth.uid() is not null;
$function$;
REVOKE ALL ON FUNCTION private.staff_experiment_versions() FROM public,anon;
GRANT EXECUTE ON FUNCTION private.staff_experiment_versions() TO authenticated;
CREATE OR REPLACE FUNCTION public.staff_experiment_versions()
RETURNS TABLE(id text,lab_version text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
select * from private.staff_experiment_versions();
$function$;
REVOKE ALL ON FUNCTION public.staff_experiment_versions() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.staff_experiment_versions() TO authenticated;
