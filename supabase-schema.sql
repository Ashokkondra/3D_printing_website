-- CVR 3D Print Lab V2 — Supabase schema
-- Run this entire file once in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create sequence if not exists public.order_number_seq start with 1043 increment by 1;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Lab Admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  price numeric(10,2) not null check (price > 0),
  material text not null default 'PLA',
  emoji text not null default '◈',
  bg text not null default 'linear-gradient(135deg,#d7e6ff,#91adf8)',
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_settings (
  id integer primary key default 1 check (id = 1),
  design_fee numeric(10,2) not null default 200 check (design_fee >= 0),
  payment_enabled boolean not null default false,
  upi_id text not null default '',
  upi_payee_name text not null default 'CVR 3D Print Lab',
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_pricing (
  id integer primary key default 1 check (id = 1),
  pla_per_gram numeric(10,2) not null default 2.6,
  petg_per_gram numeric(10,2) not null default 3.2,
  abs_per_gram numeric(10,2) not null default 3.4,
  tpu_per_gram numeric(10,2) not null default 4.2,
  machine_hour numeric(10,2) not null default 25,
  handling numeric(10,2) not null default 50,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  owner_user_id uuid not null,
  customer_name text not null,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email text,
  roll_number text,
  request_type text not null check (request_type in ('Print my model','Design + Print','Existing Design')),
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  material text,
  color text,
  quality text,
  quantity integer not null default 1 check (quantity between 1 and 50),
  dimensions text,
  needed_by date,
  notes text,
  status text not null default 'Request Submitted' check (status in ('Request Submitted','File Review','Quote Prepared','Awaiting Approval','Awaiting Payment','Payment Submitted','Paid','Approved','Printing','Ready','Completed','Rejected')),
  file_name text,
  file_path text,
  design_fee numeric(10,2),
  lab_weight numeric(10,2),
  print_time text,
  quote numeric(10,2),
  quote_type text,
  quote_prepared_at timestamptz,
  approved_at timestamptz,
  payment_status text not null default 'Not Started' check (payment_status in ('Not Started','Submitted','Verified','Rejected')),
  payment_method text not null default 'UPI',
  payment_reference text,
  payment_submitted_at timestamptz,
  payment_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists public_settings_set_updated_at on public.public_settings;
create trigger public_settings_set_updated_at before update on public.public_settings for each row execute function public.set_updated_at();
drop trigger if exists internal_pricing_set_updated_at on public.internal_pricing;
create trigger internal_pricing_set_updated_at before update on public.internal_pricing for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

insert into public.public_settings (id, design_fee) values (1, 200)
on conflict (id) do nothing;
insert into public.internal_pricing (id) values (1)
on conflict (id) do nothing;

insert into public.products (name,category,price,material,emoji,bg,description,active,sort_order) values
('Custom Name Keychain','Personalised',99,'PLA','🔑','linear-gradient(135deg,#c9f6e8,#79d9b9)','A compact personalised name keychain, ideal for bags, keys and small gifts.',true,1),
('Mechanical Gear Model','Engineering',149,'PLA','⚙️','linear-gradient(135deg,#d7e6ff,#91adf8)','A display-friendly gear model for demos, classroom use and mechanical project presentations.',true,2),
('Phone Stand','Utility',179,'PLA','📱','linear-gradient(135deg,#ffe5c2,#ffb878)','A simple desktop phone stand with a stable base and charging-cable clearance.',true,3),
('Miniature Rocket','Models',229,'PLA','🚀','linear-gradient(135deg,#eedcff,#c9a7f5)','A decorative miniature rocket for desks, displays and student events.',true,4),
('Cable Organizer','Utility',89,'PLA','🔌','linear-gradient(135deg,#d7f0ff,#8dd2f0)','A compact cable-management clip for desks and charging setups.',true,5),
('Bearing Cutaway Demo','Engineering',249,'PETG','🛞','linear-gradient(135deg,#dce4ec,#95a8ba)','A simplified bearing demonstration model for mechanical engineering explanations.',true,6),
('Desk Name Plate','Personalised',199,'PLA','🏷️','linear-gradient(135deg,#fff0c8,#f7cb68)','A custom desk name plate for students, faculty or project teams.',true,7),
('Low-Poly Planter','Decor',299,'PLA','🪴','linear-gradient(135deg,#d7f7d7,#90d890)','A geometric low-poly planter for succulents or desk decoration.',true,8)
on conflict (name) do nothing;

-- Admin helper. SECURITY DEFINER prevents RLS recursion on admin_profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active = true
  );
$$;

create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

-- Customer order creation. Catalogue pricing is calculated in the database,
-- so customers cannot change the fixed product price in browser developer tools.
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
    p_needed_by,nullif(trim(coalesce(p_notes,'')),''),case when p_request_type='Existing Design' then 'Awaiting Payment' else 'Request Submitted' end,case when p_request_type='Design + Print' then v_design_fee else null end,
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

create or replace function public.attach_order_file(
  p_order_code text,
  p_phone text,
  p_file_path text,
  p_file_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then return false; end if;
  update public.orders
  set file_path=p_file_path, file_name=p_file_name
  where upper(order_code)=upper(trim(p_order_code))
    and phone=regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
    and owner_user_id=auth.uid();
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- Tracking requires BOTH order code and the mobile number used at checkout.
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
  set status='Awaiting Payment', approved_at=now(), payment_status='Not Started'
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

-- Row Level Security
alter table public.admin_profiles enable row level security;
alter table public.products enable row level security;
alter table public.public_settings enable row level security;
alter table public.internal_pricing enable row level security;
alter table public.orders enable row level security;

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select to anon, authenticated using (active = true);
drop policy if exists "products admin all" on public.products;
create policy "products admin all" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings public read" on public.public_settings;
create policy "settings public read" on public.public_settings for select to anon, authenticated using (true);
drop policy if exists "settings admin update" on public.public_settings;
create policy "settings admin update" on public.public_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "internal pricing admin" on public.internal_pricing;
create policy "internal pricing admin" on public.internal_pricing for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders admin all" on public.orders;
create policy "orders admin all" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin profiles admin read" on public.admin_profiles;
create policy "admin profiles admin read" on public.admin_profiles for select to authenticated using (public.is_admin());

-- Least-privilege Data API grants. RLS still applies.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.public_settings to anon, authenticated;
grant update on public.public_settings to authenticated;
grant select, update on public.internal_pricing to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select on public.admin_profiles to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.create_order(text,text,text,text,text,uuid,text,text,text,integer,text,date,text) to authenticated;
grant execute on function public.attach_order_file(text,text,text,text) to authenticated;
grant execute on function public.track_order(text,text) to authenticated;
grant execute on function public.accept_order_quote(text,text) to authenticated;

-- Private file bucket, capped at 25 MB per file.
insert into storage.buckets (id,name,public,file_size_limit)
values ('order-files','order-files',false,26214400)
on conflict (id) do update set public=false, file_size_limit=26214400;

-- Customer uploads live under: <auth.uid()>/<order uuid>/<random>-filename
-- Anonymous Supabase users use the authenticated role, so each visitor gets an owner identity.
drop policy if exists "customers upload own order files" on storage.objects;
create policy "customers upload own order files"
on storage.objects for insert to authenticated
with check (
  bucket_id='order-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);

drop policy if exists "customers read own order files" on storage.objects;
create policy "customers read own order files"
on storage.objects for select to authenticated
using (
  bucket_id='order-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);

drop policy if exists "admins read all order files" on storage.objects;
create policy "admins read all order files"
on storage.objects for select to authenticated
using (bucket_id='order-files' and public.is_admin());

-- IMPORTANT: after creating your first admin user in Authentication -> Users,
-- run this separately with the real email address:
-- insert into public.admin_profiles (user_id, display_name)
-- select id, 'Lab Admin' from auth.users where email='YOUR_ADMIN_EMAIL';
