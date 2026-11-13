-- =====================================================================
-- الريال العماني (3 خانات عشرية) + الباركود
-- =====================================================================

-- 1) المبالغ بثلاث خانات (بيسة)
alter table public.products       alter column price      type numeric(12, 3);
alter table public.product_costs  alter column cost_price type numeric(12, 3);
alter table public.invoice_items  alter column unit_price type numeric(12, 3),
                                  alter column line_total type numeric(12, 3);
alter table public.invoices       alter column subtotal      type numeric(12, 3),
                                  alter column discount      type numeric(12, 3),
                                  alter column vat_amount    type numeric(12, 3),
                                  alter column total         type numeric(12, 3),
                                  alter column paid_amount   type numeric(12, 3),
                                  alter column change_amount type numeric(12, 3);

-- 2) ضريبة القيمة المضافة في عُمان 5%
alter table public.settings alter column vat_rate set default 5;
update public.settings
set vat_rate = 5,
    vat_number = case when vat_number = '300000000000003' then '' else vat_number end,
    address = case when address = 'المملكة العربية السعودية' then 'سلطنة عُمان' else address end
where id = 1;

-- أسعار المنتجات التجريبية بالريال العماني
update public.products p set price = v.price
from (values ('سكري مفتل', 4.500), ('خلاص الأحساء', 3.800), ('عجوة المدينة', 9.000), ('مجدول فاخر', 7.500),
             ('علبة سكري 1 كيلو', 5.500), ('علبة عجوة 500 جرام', 5.000), ('صينية ضيافة صغيرة', 12.000),
             ('بوكس هدايا فاخر', 18.500), ('صقعي ملكي', 6.000)) as v(name, price)
where p.name = v.name;

-- 3) الباركود
alter table public.products add column barcode text;
create unique index products_barcode_key on public.products (barcode) where barcode is not null;

create sequence if not exists private.barcode_seq start 1;

-- EAN-13 داخلي يبدأ بـ 200 (نطاق الاستخدام الداخلي للمحلات)
create or replace function private.next_ean13()
returns text language plpgsql set search_path = '' as $$
declare
  base text;
  s int := 0;
  i int;
begin
  loop
    base := '200' || lpad(nextval('private.barcode_seq')::text, 9, '0');
    s := 0;
    for i in 1..12 loop
      s := s + substr(base, i, 1)::int * case when i % 2 = 0 then 3 else 1 end;
    end loop;
    base := base || ((10 - s % 10) % 10)::text;
    exit when not exists (select 1 from public.products where barcode = base);
  end loop;
  return base;
end;
$$;

create or replace function private.products_default_barcode()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.barcode := nullif(trim(new.barcode), '');
  if new.barcode is null then
    new.barcode := private.next_ean13();
  end if;
  return new;
end;
$$;
revoke all on function private.next_ean13(), private.products_default_barcode() from public, anon, authenticated;

create trigger products_barcode before insert or update of barcode on public.products
  for each row execute function private.products_default_barcode();

update public.products set barcode = private.next_ean13() where barcode is null;

-- 4) إنشاء الفاتورة بالتقريب لثلاث خانات
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
  v_lines       jsonb := '[]'::jsonb;
  v_pos         int;
  v_subtotal    numeric := 0;
  v_discount    numeric := round(coalesce((payload ->> 'discount')::numeric, 0), 3);
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
    v_line := round(v_qty * v_prod.price, 3);
    v_subtotal := v_subtotal + v_line;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_prod.id, 'name', v_prod.name, 'sale_type', v_prod.sale_type,
      'qty', v_qty, 'price', v_prod.price, 'line', v_line);
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'قيمة الخصم غير صحيحة';
  end if;
  v_net := v_subtotal - v_discount;
  if v_vat_enabled then
    if v_settings.prices_include_vat then
      v_total := v_net;
      v_vat   := round(v_net - v_net / (1 + v_rate), 3);
    else
      v_vat   := round(v_net * v_rate, 3);
      v_total := v_net + v_vat;
    end if;
  else
    v_vat   := 0;
    v_total := v_net;
  end if;

  if v_method = 'cash' then
    v_paid := round(coalesce((payload ->> 'paid_amount')::numeric, v_total), 3);
    if v_paid < v_total then
      raise exception 'المبلغ المدفوع أقل من الإجمالي';
    end if;
  else
    v_paid := v_total;
  end if;

  insert into public.invoices (cashier_id, customer_name, customer_phone, payment_method,
                               vat_enabled, vat_rate, prices_include_vat,
                               subtotal, discount, vat_amount, total, paid_amount, change_amount)
  values (v_uid,
          nullif(trim(payload ->> 'customer_name'), ''),
          nullif(trim(payload ->> 'customer_phone'), ''),
          v_method, v_vat_enabled,
          case when v_vat_enabled then v_settings.vat_rate else 0 end,
          v_settings.prices_include_vat,
          v_subtotal, v_discount, v_vat, v_total, v_paid, v_paid - v_total)
  returning id into v_inv_id;

  for v_item, v_pos in select e, o::int from jsonb_array_elements(v_lines) with ordinality as t(e, o) loop
    insert into public.invoice_items (invoice_id, line_no, product_id, product_name, sale_type, qty, unit_price, line_total)
    values (v_inv_id, v_pos, (v_item ->> 'product_id')::uuid, v_item ->> 'name', (v_item ->> 'sale_type')::public.sale_type,
            (v_item ->> 'qty')::numeric, (v_item ->> 'price')::numeric, (v_item ->> 'line')::numeric);

    update public.products set stock_qty = stock_qty - (v_item ->> 'qty')::numeric
    where id = (v_item ->> 'product_id')::uuid;

    insert into public.stock_movements (product_id, change, reason, invoice_id, user_id)
    values ((v_item ->> 'product_id')::uuid, -(v_item ->> 'qty')::numeric, 'sale', v_inv_id, v_uid);
  end loop;

  return v_inv_id;
end;
$$;

revoke all on function public.create_invoice(jsonb) from public, anon;
grant execute on function public.create_invoice(jsonb) to authenticated;
