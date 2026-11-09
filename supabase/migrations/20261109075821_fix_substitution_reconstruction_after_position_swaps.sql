begin;
do $migration$
declare
  old_definition text;
  new_definition text;
begin
  select pg_get_functiondef('public.season_action(jsonb)'::regprocedure) into old_definition;

  new_definition := replace(
    old_definition,
    $old$jsonb_build_object('in',player_in_id,'out',player_out_id,'position',position)$old$,
    $new$jsonb_build_object('in',player_in_id,'out',player_out_id,'position',position,'swap',swap,'previous',player_in_previous_position)$new$
  );

  new_definition := replace(
    new_definition,
    $old$current_positions:=jsonb_set(current_positions,array[item->>'out'],to_jsonb('bench'::text)); current_positions:=jsonb_set(current_positions,array[item->>'in'],to_jsonb(item->>'position'));$old$,
    $new$if coalesce((item->>'swap')::boolean,false) then
        current_positions:=jsonb_set(current_positions,array[item->>'out'],to_jsonb(item->>'previous'));
      else
        current_positions:=jsonb_set(current_positions,array[item->>'out'],to_jsonb('bench'::text));
      end if;
      current_positions:=jsonb_set(current_positions,array[item->>'in'],to_jsonb(item->>'position'));$new$
  );

  if old_definition is null or new_definition=old_definition
    or position('''swap'',swap' in new_definition)=0
    or position('item->>''previous''' in new_definition)=0 then
    raise exception 'Fant ikke forventet spillerbyttevalidering i season_action.';
  end if;

  execute new_definition;
end
$migration$;
commit;
