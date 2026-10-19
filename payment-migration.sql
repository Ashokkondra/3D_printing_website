-- CVR 3D Print Lab V2.2 — payment upgrade for an EXISTING V2/V2.1 Supabase project
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.

alter table public.public_settings
  add column if not exists payment_enabled boolean not null default false,
  add column if not exists upi_id text not null default '',
  add column if not exists upi_payee_name text not null default 'CVR 3D Print Lab';

alter table public.orders
  add column if not exists payment_status text not null default 'Not Started',
  add column if not exists payment_method text not null default 'UPI',
  add column if not exists payment_reference text,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_verified_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in (
      'Request Submitted','File Review','Quote Prepared','Awaiting Approval',
      'Awaiting Payment','Payment Submitted','Paid','Approved','Printing',
      'Ready','Completed','Rejected'
    )
  );

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check check (
    payment_status in ('Not Started','Submitted','Verified','Rejected')
  );

create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_roll_number text,
  p_request_type text,
  p_product_id uuid,
  p_material text,
  p_color text,
  p_quality text,
  p_quantity integer,
  p_dimensions text,
  p_needed_by date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  v_code text;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_design_fee numeric(10,2);
  v_quote numeric(10,2) := null;
  v_quote_type text := null;
  v_material text := p_material;
  v_product_name text := null;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Customer name is required'; end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Invalid Indian mobile number'; end if;
  if p_request_type not in ('Print my model','Design + Print','Existing Design') then raise exception 'Invalid request type'; end if;
  if coalesce(p_quantity,0) < 1 or p_quantity > 50 then raise exception 'Quantity must be between 1 and 50'; end if;

  select design_fee into v_design_fee from public.public_settings where id=1;

  if p_request_type = 'Existing Design' then
    if p_product_id is null then raise exception 'Product is required'; end if;
    select * into v_product from public.products where id=p_product_id and active=true;
    if not found then raise exception 'Product is unavailable'; end if;
    v_quote := v_product.price * p_quantity;
    v_quote_type := 'Fixed catalogue price';
    v_material := v_product.material;
    v_product_name := v_product.name;
  end if;

  v_code := 'CVR3D-' || lpad(nextval('public.order_number_seq')::text,4,'0');

  insert into public.orders (
    order_code,owner_user_id,customer_name,phone,email,roll_number,request_type,product_id,product_name,
    material,color,quality,quantity,dimensions,needed_by,notes,status,design_fee,quote,quote_type,file_name
  ) values (
    v_code,auth.uid(),trim(p_customer_name),v_phone,nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_roll_number,'')),''),
    p_request_type,p_product_id,v_product_name,v_material,p_color,p_quality,p_quantity,nullif(trim(coalesce(p_dimensions,'')),''),
    p_needed_by,nullif(trim(coalesce(p_notes,'')),''),case when p_request_type='Existing Design' then 'Awaiting Payment' else 'Request Submitted' end,
    case when p_request_type='Design + Print' then v_design_fee else null end,
    v_quote,v_quote_type,case when p_request_type='Existing Design' then 'Catalogue item' else null end
  ) returning * into v_order;

  return jsonb_build_object(
    'order_uuid', v_order.id,
    'order_code', v_order.order_code,
    'quote', v_order.quote,
    'design_fee', v_order.design_fee
  );
end;
$$;

create or replace function public.track_order(p_order_code text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_code',o.order_code,
    'customer_name',o.customer_name,
    'request_type',o.request_type,
    'product_name',o.product_name,
    'material',o.material,
    'color',o.color,
    'quality',o.quality,
    'quantity',o.quantity,
    'dimensions',o.dimensions,
    'notes',o.notes,
    'status',o.status,
    'created_at',o.created_at,
    'file_name',o.file_name,
    'design_fee',o.design_fee,
    'lab_weight',o.lab_weight,
    'print_time',o.print_time,
    'quote',o.quote,
    'quote_type',o.quote_type,
    'payment_status',o.payment_status,
    'payment_method',o.payment_method,
    'payment_reference',o.payment_reference,
    'payment_submitted_at',o.payment_submitted_at,
    'payment_verified_at',o.payment_verified_at
  )
  from public.orders o
  where upper(o.order_code)=upper(trim(p_order_code))
    and o.phone=regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
  limit 1;
$$;

create or replace function public.accept_order_quote(p_order_code text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.orders
  set status='Awaiting Payment',
      approved_at=now(),
      payment_status='Not Started'
  where upper(order_code)=upper(trim(p_order_code))
    and phone=regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
    and quote is not null
    and request_type <> 'Existing Design'
    and status in ('Quote Prepared','Awaiting Approval');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.submit_payment_reference(
  p_order_code text,
  p_phone text,
  p_payment_reference text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_ref text := regexp_replace(trim(coalesce(p_payment_reference,'')), '\s+', '', 'g');
begin
  if length(v_ref) < 6 or length(v_ref) > 40 then
    raise exception 'Invalid payment reference';
  end if;

  update public.orders
  set payment_reference=v_ref,
      payment_status='Submitted',
      payment_submitted_at=now(),
      status='Payment Submitted'
  where upper(order_code)=upper(trim(p_order_code))
    and phone=regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
    and quote is not null
    and status in ('Awaiting Payment','Payment Submitted');

  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- Existing catalogue orders with a fixed quote can move directly to payment.
update public.orders
set status='Awaiting Payment'
where request_type='Existing Design'
  and quote is not null
  and status='Request Submitted';
