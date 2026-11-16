-- =====================================================================
-- طلبات قيد التجهيز + رسالة واتساب عند الجاهزية
-- =====================================================================

alter table public.invoices
  add column order_status text check (order_status in ('preparing', 'ready', 'delivered')),
  add column order_note   text,
  add column ready_at     timestamptz,
  add column delivered_at timestamptz;

create index invoices_open_orders_idx on public.invoices (created_at desc)
  where order_status is not null;

alter table public.settings
  add column whatsapp_ready_message text not null
    default 'مرحباً {الاسم}، طلبك رقم {الرقم} من {المحل} جاهز للاستلام. نسعد بزيارتك 🌴';

-- تحويل فاتورة إلى طلب للتجهيز (بعد إنشائها مباشرة من نقطة البيع)
create or replace function public.mark_as_order(p_invoice uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.invoices;
begin
  if not private.is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select * into v from public.invoices where id = p_invoice for update;
  if not found or v.status <> 'paid' then
    raise exception 'الفاتورة غير موجودة';
  end if;
  if not private.is_admin() and v.cashier_id is distinct from auth.uid() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if coalesce(trim(v.customer_phone), '') = '' then
    raise exception 'رقم جوال الزبون مطلوب لإرسال إشعار الجاهزية';
  end if;
  update public.invoices
  set order_status = 'preparing', order_note = nullif(trim(p_note), '')
  where id = p_invoice;
end;
$$;

-- تغيير حالة الطلب: قيد التجهيز ← جاهز ← تم التسليم
create or replace function public.set_order_status(p_invoice uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if p_status not in ('preparing', 'ready', 'delivered') then
    raise exception 'حالة غير صحيحة';
  end if;
  update public.invoices
  set order_status = p_status,
      ready_at     = case when p_status = 'ready' then coalesce(ready_at, now()) when p_status = 'preparing' then null else ready_at end,
      delivered_at = case when p_status = 'delivered' then now() else null end
  where id = p_invoice and order_status is not null and status = 'paid';
  if not found then
    raise exception 'الطلب غير موجود';
  end if;
end;
$$;

-- قائمة الطلبات لكل الموظفين (المفتوحة + المسلّمة خلال آخر يومين)
create or replace function public.get_orders()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(o) - 'sort_key' order by o.sort_key, o.created_at)
    from (
      select i.id, i.invoice_no, i.customer_name, i.customer_phone, i.order_status, i.order_note,
             i.total, i.created_at, i.ready_at, i.delivered_at,
             case i.order_status when 'preparing' then 0 when 'ready' then 1 else 2 end as sort_key,
             (select jsonb_agg(jsonb_build_object('name', it.product_name, 'qty', it.qty, 'sale_type', it.sale_type) order by it.line_no)
              from public.invoice_items it where it.invoice_id = i.id) as items
      from public.invoices i
      where i.status = 'paid'
        and (i.order_status in ('preparing', 'ready')
             or (i.order_status = 'delivered' and i.delivered_at > now() - interval '2 days'))
    ) o
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.mark_as_order(uuid, text), public.set_order_status(uuid, text), public.get_orders() from public, anon;
grant execute on function public.mark_as_order(uuid, text), public.set_order_status(uuid, text), public.get_orders() to authenticated;
