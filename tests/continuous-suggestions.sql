-- Run against the migrated project. Every fixture is rolled back.
begin;
select set_config('enough_test.user_a',gen_random_uuid()::text,true),set_config('enough_test.user_b',gen_random_uuid()::text,true),set_config('enough_test.token',gen_random_uuid()::text,true);
insert into auth.users(id,email,is_anonymous)
 select id,'enough-suggestions-test-'||id::text||'@example.invalid',false
 from (values(current_setting('enough_test.user_a')::uuid),(current_setting('enough_test.user_b')::uuid)) as users(id);
insert into public.enough_accounts(user_id,state_json)
 select id,'{}'::jsonb from (values(current_setting('enough_test.user_a')::uuid),(current_setting('enough_test.user_b')::uuid)) as users(id);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('enough_test.user_a'),'role','authenticated','is_anonymous',false)::text,true);
do $$
declare token uuid;other uuid;item jsonb;n integer;kept integer;revision integer;cursor bigint;
begin
 for n in 1..12 loop
  token=gen_random_uuid();other=gen_random_uuid();
  if not public.enough_begin_ai_request(token) then raise exception 'Sequential request % blocked',n;end if;
  if public.enough_begin_ai_request(other) then raise exception 'Concurrent request admitted';end if;
  perform public.enough_end_ai_request(other);
  if public.enough_begin_ai_request(other) then raise exception 'Wrong token released request';end if;
  perform public.enough_end_ai_request(token);
 end loop;
 if public.enough_take_ai_slot() is null then raise exception 'Legacy daily allowance blocked';end if;
 for n in 1..7 loop
  if public.enough_take_ai_slot() is null then raise exception 'Legacy sixth request blocked';end if;
 end loop;
 for n in 1..125 loop
  item=jsonb_build_object('id',1000+n,'key','ai-'||n,'title','Suggestion check '||n,'category','chores','usual','Leave the cards until later.','body','Sort cards at a comfortable table.','minutes',10,'extraMin',0,'moneyCents',0,'moneySource','none','enjoy',jsonb_build_array('Learning'),'outdoor',false,'effort','gentle','exclude',jsonb_build_array(),'safety','Stay within your comfort.','social',false,'output','Sorted cards','family','cards','mechanism','combine','movementMode','seated','source','ai','brief','A useful moment. Feel ready. A tidy table.');
  select count(*) into kept from public.enough_keep_ideas(jsonb_build_array(item));
  if kept<>1 then raise exception 'Suggestion % not retained',n;end if;
 end loop;
 if (select count(*) from public.enough_ideas)<>125 then raise exception 'History was capped';end if;
 select min(sequence) into cursor from (select sequence from public.enough_ideas order by sequence desc limit 100) as page;
 if (select count(*) from public.enough_ideas where sequence<cursor)<>25 then raise exception 'Cursor history lost rows';end if;
 select count(*) into kept from public.enough_keep_ideas(jsonb_build_array(item||jsonb_build_object('id',5000,'title','  SUGGESTION CHECK 125  ')));
 if kept<>0 then raise exception 'Repeated title admitted';end if;
 select s.revision into revision from public.enough_save_account(jsonb_build_object('generated',jsonb_build_array(item||jsonb_build_object('id',6000,'title','Imported suggestion'))),1) s;
 if revision<>2 then raise exception 'Account revision failed';end if;
 select count(*) into kept from public.enough_save_account(jsonb_build_object('generated',jsonb_build_array(item||jsonb_build_object('id',6001,'title','Stale suggestion'))),1);
 if kept<>0 or exists(select 1 from public.enough_ideas where idea_id=6001) then raise exception 'Stale save archived data';end if;
 begin
  insert into public.enough_ideas(user_id,idea_id,idea_json) values(current_setting('enough_test.user_b')::uuid,1125,item);
  raise exception 'Cross-owner insert admitted';
 exception when insufficient_privilege then null;end;
 if not public.enough_begin_ai_request(current_setting('enough_test.token')::uuid) then raise exception 'Owner A reservation failed';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('enough_test.user_b'),'role','authenticated','is_anonymous',false)::text,true);
do $$
declare token uuid=gen_random_uuid();
begin
 if exists(select 1 from public.enough_ideas) then raise exception 'Cross-owner history leak';end if;
 if not public.enough_begin_ai_request(token) then raise exception 'Independent owner blocked';end if;
 perform public.enough_end_ai_request(current_setting('enough_test.token')::uuid);
 perform public.enough_end_ai_request(token);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('enough_test.user_a'),'role','authenticated','is_anonymous',false)::text,true);
do $$begin
 if public.enough_begin_ai_request(gen_random_uuid()) then raise exception 'Another owner released reservation';end if;
 perform public.enough_end_ai_request(current_setting('enough_test.token')::uuid);
end $$;
-- Expiry recovers an abandoned process, and its old token cannot cancel the new request.
select public.enough_begin_ai_request(current_setting('enough_test.token')::uuid);
reset role;
update enough_private.ai_requests set expires_at=now()-interval '1 second' where user_id=current_setting('enough_test.user_a')::uuid;
set local role authenticated;
do $$declare token uuid=gen_random_uuid();begin
 if not public.enough_begin_ai_request(token) then raise exception 'Expired request failed to recover';end if;
 perform public.enough_end_ai_request(current_setting('enough_test.token')::uuid);
 if public.enough_begin_ai_request(gen_random_uuid()) then raise exception 'Expired token cancelled new request';end if;
 perform public.enough_end_ai_request(token);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('enough_test.user_a'),'role','authenticated','is_anonymous',true)::text,true);
do $$begin
 if exists(select 1 from public.enough_ideas) then raise exception 'Anonymous history leak';end if;
 begin
  perform public.enough_begin_ai_request(gen_random_uuid());raise exception 'Anonymous request admitted';
 exception when raise_exception then if sqlerrm<>'Sign in required' then raise;end if;end;
end $$;
set local role anon;
do $$begin
 begin perform public.enough_begin_ai_request(gen_random_uuid());raise exception 'Unauthenticated request admitted';exception when insufficient_privilege then null;end;
 begin perform 1 from public.enough_ideas;raise exception 'Unauthenticated history admitted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: 12 sequential requests, overlap/expiry protection, token/owner isolation, 125 archived ideas, cursor pages, title deduplication, imports, stale revisions and anonymous denial; fixtures rolled back' as checks;
