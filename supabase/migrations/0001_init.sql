-- =====================================================================
-- جوهرة النخيل — المخطط الأساسي
-- =====================================================================

create schema if not exists private;

-- ---------- الأنواع ----------
create type public.user_role      as enum ('admin', 'cashier');
create type public.sale_type      as enum ('weight', 'unit');
create type public.payment_method as enum ('cash', 'card');
create type public.invoice_status as enum ('paid', 'void');
create type public.stock_reason   as enum ('initial', 'sale', 'restock', 'adjust', 'void');

-- ---------- الجداول ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'cashier',
  -- أي حساب جديد يكون معطلاً حتى يفعله المدير (حماية من التسجيل العام)
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  category_id          uuid references public.categories (id) on delete restrict,
  name                 text not null check (length(trim(name)) > 0),
  description          text,
  image_url            text,
  sale_type            public.sale_type not null default 'unit',
  price                numeric(12, 2) not null check (price >= 0),
  stock_qty            numeric(12, 3) not null default 0,
  low_stock_threshold  numeric(12, 3) not null default 0,
  show_on_display      boolean not null default true,
  is_active            boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);

create table public.product_costs (
  product_id  uuid primary key references public.products (id) on delete cascade,
  cost_price  numeric(12, 2) not null default 0 check (cost_price >= 0)
);

create table public.settings (
  id                      int primary key default 1 check (id = 1),
  shop_name               text not null default 'جوهرة النخيل',
  shop_subtitle           text not null default 'لتغليف وتشكيل التمور',
  vat_number              text not null default '',
  cr_number               text not null default '',
  address                 text not null default '',
  phone                   text not null default '',
  vat_enabled_default     boolean not null default true,
  vat_rate                numeric(5, 2) not null default 15 check (vat_rate >= 0 and vat_rate <= 100),
  prices_include_vat      boolean not null default true,
  invoice_footer          text not null default 'شكراً لزيارتكم',
  display_rotate_seconds  int not null default 12 check (display_rotate_seconds between 4 and 120),
  updated_at              timestamptz not null default now()
);

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_no          bigint generated always as identity (start with 1001) unique,
  cashier_id          uuid references public.profiles (id) on delete set null,
  customer_name       text,
  customer_phone      text,
  subtotal            numeric(12, 2) not null default 0,
  discount            numeric(12, 2) not null default 0,
  vat_enabled         boolean not null,
  vat_rate            numeric(5, 2) not null default 0,
  prices_include_vat  boolean not null default true,
  vat_amount          numeric(12, 2) not null default 0,
  total               numeric(12, 2) not null default 0,
  payment_method      public.payment_method not null,
  paid_amount         numeric(12, 2) not null default 0,
  change_amount       numeric(12, 2) not null default 0,
  status              public.invoice_status not null default 'paid',
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index invoices_cashier_id_idx on public.invoices (cashier_id);
create index invoices_voided_by_idx  on public.invoices (voided_by);
create index invoices_created_at_idx on public.invoices (created_at desc);

create table public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  sale_type     public.sale_type not null,
  qty           numeric(12, 3) not null check (qty > 0),
  unit_price    numeric(12, 2) not null,
  line_total    numeric(12, 2) not null
);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index invoice_items_product_id_idx on public.invoice_items (product_id);

create table public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  change      numeric(12, 3) not null,
  reason      public.stock_reason not null,
  note        text,
  invoice_id  uuid references public.invoices (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_invoice_id_idx on public.stock_movements (invoice_id);
create index stock_movements_user_id_idx    on public.stock_movements (user_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);

-- ---------- دوال مساعدة (في مخطط private غير مكشوف للـ API) ----------
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

-- إنشاء ملف المستخدم تلقائياً (دائماً كاشير معطّل؛ المدير يفعّله)
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function private.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_costs   enable row level security;
alter table public.settings        enable row level security;
alter table public.invoices        enable row level security;
alter table public.invoice_items   enable row level security;
alter table public.stock_movements enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- categories
create policy categories_select on public.categories for select to authenticated
  using ((select private.is_staff()));
create policy categories_insert on public.categories for insert to authenticated
  with check ((select private.is_admin()));
create policy categories_update on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete on public.categories for delete to authenticated
  using ((select private.is_admin()));

-- products
create policy products_select on public.products for select to authenticated
  using ((select private.is_staff()));
create policy products_insert on public.products for insert to authenticated
  with check ((select private.is_admin()));
create policy products_update on public.products for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy products_delete on public.products for delete to authenticated
  using ((select private.is_admin()));

-- product_costs (المدير فقط)
create policy product_costs_select on public.product_costs for select to authenticated
  using ((select private.is_admin()));
create policy product_costs_insert on public.product_costs for insert to authenticated
  with check ((select private.is_admin()));
create policy product_costs_update on public.product_costs for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy product_costs_delete on public.product_costs for delete to authenticated
  using ((select private.is_admin()));

-- settings
create policy settings_select on public.settings for select to authenticated
  using ((select private.is_staff()));
create policy settings_update on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- invoices (الإنشاء عبر create_invoice فقط)
create policy invoices_select on public.invoices for select to authenticated
  using (
    (select private.is_admin())
    or (cashier_id = (select auth.uid()) and (select private.is_staff()))
  );

create policy invoice_items_select on public.invoice_items for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
      and ((select private.is_admin())
           or (i.cashier_id = (select auth.uid()) and (select private.is_staff())))
  ));

-- stock_movements (المدير فقط)
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select private.is_admin()));

-- ---------- دوال API ----------

-- إنشاء فاتورة: الأسعار تُقرأ من قاعدة البيانات فقط
create or replace function public.create_invoice(payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid         uuid := auth.uid();
  v_settings    public.settings;
  v_inv_id      uuid;
  v_item        jsonb;
  v_prod        public.products;
  v_qty         numeric;
  v_line        numeric;
  v_subtotal    numeric := 0;
  v_discount    numeric := round(coalesce((payload ->> 'discount')::numeric, 0), 2);
  v_vat_enabled boolean := coalesce((payload ->> 'vat_enabled')::boolean, false);
  v_rate        numeric;
  v_net         numeric;
  v_vat         numeric;
  v_total       numeric;
  v_method      public.payment_method := coalesce(payload ->> 'payment_method', 'cash')::public.payment_method;
  v_paid        numeric;
begin
  if not private.is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if jsonb_typeof(payload -> 'items') is distinct from 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'الفاتورة فارغة';
  end if;

  select * into v_settings from public.settings where id = 1;
  v_rate := v_settings.vat_rate / 100;

  insert into public.invoices (cashier_id, customer_name, customer_phone, payment_method,
                               vat_enabled, vat_rate, prices_include_vat)
  values (v_uid,
          nullif(trim(payload ->> 'customer_name'), ''),
          nullif(trim(payload ->> 'customer_phone'), ''),
          v_method,
          v_vat_enabled,
          case when v_vat_enabled then v_settings.vat_rate else 0 end,
          v_settings.prices_include_vat)
  returning id into v_inv_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    v_qty := round((v_item ->> 'qty')::numeric, 3);
    if v_qty is null or v_qty <= 0 then
      raise exception 'كمية غير صحيحة';
    end if;

    select * into v_prod from public.products
    where id = (v_item ->> 'product_id')::uuid and is_active
    for update;
    if not found then
      raise exception 'منتج غير موجود أو موقوف';
    end if;
    if v_prod.sale_type = 'unit' and v_qty <> trunc(v_qty) then
      raise exception 'كمية المنتج "%" يجب أن تكون عدداً صحيحاً', v_prod.name;
    end if;

    v_line := round(v_qty * v_prod.price, 2);
    v_subtotal := v_subtotal + v_line;

    insert into public.invoice_items (invoice_id, product_id, product_name, sale_type, qty, unit_price, line_total)
    values (v_inv_id, v_prod.id, v_prod.name, v_prod.sale_type, v_qty, v_prod.price, v_line);

    update public.products set stock_qty = stock_qty - v_qty where id = v_prod.id;

    insert into public.stock_movements (product_id, change, reason, invoice_id, user_id)
    values (v_prod.id, -v_qty, 'sale', v_inv_id, v_uid);
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'قيمة الخصم غير صحيحة';
  end if;

  v_net := v_subtotal - v_discount;
  if v_vat_enabled then
    if v_settings.prices_include_vat then
      v_total := v_net;
      v_vat   := round(v_net - v_net / (1 + v_rate), 2);
    else
      v_vat   := round(v_net * v_rate, 2);
      v_total := v_net + v_vat;
    end if;
  else
    v_vat   := 0;
    v_total := v_net;
  end if;

  if v_method = 'cash' then
    v_paid := round(coalesce((payload ->> 'paid_amount')::numeric, v_total), 2);
    if v_paid < v_total then
      raise exception 'المبلغ المدفوع أقل من الإجمالي';
    end if;
  else
    v_paid := v_total;
  end if;

  update public.invoices
  set subtotal = v_subtotal, discount = v_discount, vat_amount = v_vat, total = v_total,
      paid_amount = v_paid, change_amount = v_paid - v_total
  where id = v_inv_id;

  return v_inv_id;
end;
$$;

-- إلغاء فاتورة وإرجاع المخزون (المدير فقط)
create or replace function public.void_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_item record;
begin
  if not private.is_admin() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;

  update public.invoices
  set status = 'void', voided_at = now(), voided_by = v_uid
  where id = p_invoice_id and status = 'paid';
  if not found then
    raise exception 'الفاتورة غير موجودة أو ملغاة مسبقاً';
  end if;

  for v_item in
    select product_id, qty from public.invoice_items
    where invoice_id = p_invoice_id and product_id is not null
  loop
    update public.products set stock_qty = stock_qty + v_item.qty where id = v_item.product_id;
    insert into public.stock_movements (product_id, change, reason, invoice_id, user_id)
    values (v_item.product_id, v_item.qty, 'void', p_invoice_id, v_uid);
  end loop;
end;
$$;

-- تعديل المخزون (المدير فقط)
create or replace function public.adjust_stock(
  p_product_id uuid, p_change numeric, p_reason public.stock_reason, p_note text default null
)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_new numeric;
begin
  if not private.is_admin() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if p_reason not in ('initial', 'restock', 'adjust') then
    raise exception 'سبب غير مسموح';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'الكمية يجب ألا تكون صفراً';
  end if;

  update public.products set stock_qty = stock_qty + round(p_change, 3)
  where id = p_product_id
  returning stock_qty into v_new;
  if not found then
    raise exception 'منتج غير موجود';
  end if;

  insert into public.stock_movements (product_id, change, reason, note, user_id)
  values (p_product_id, round(p_change, 3), p_reason, nullif(trim(p_note), ''), auth.uid());
  return v_new;
end;
$$;

-- قائمة شاشة العرض (عامة، حقول آمنة فقط)
create or replace function public.get_display_menu()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop_name',      s.shop_name,
    'shop_subtitle',  s.shop_subtitle,
    'rotate_seconds', s.display_rotate_seconds,
    'categories', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', c.id, 'name', c.name, 'products', c.products)
               order by c.sort_order, c.name)
      from (
        select cat.id, cat.name, cat.sort_order,
               jsonb_agg(jsonb_build_object(
                 'id', p.id, 'name', p.name, 'description', p.description,
                 'image_url', p.image_url, 'sale_type', p.sale_type, 'price', p.price
               ) order by p.sort_order, p.name) as products
        from public.categories cat
        join public.products p on p.category_id = cat.id
        where cat.is_active and p.is_active and p.show_on_display
        group by cat.id
      ) c
    ), '[]'::jsonb)
  )
  from public.settings s
  where s.id = 1;
$$;

revoke all on function public.create_invoice(jsonb) from public, anon;
revoke all on function public.void_invoice(uuid) from public, anon;
revoke all on function public.adjust_stock(uuid, numeric, public.stock_reason, text) from public, anon;
revoke all on function public.get_display_menu() from public;
grant execute on function public.create_invoice(jsonb) to authenticated;
grant execute on function public.void_invoice(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, public.stock_reason, text) to authenticated;
grant execute on function public.get_display_menu() to anon, authenticated;

-- ---------- التخزين: صور المنتجات ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

-- ---------- بيانات أولية ----------
insert into public.settings (id) values (1);
