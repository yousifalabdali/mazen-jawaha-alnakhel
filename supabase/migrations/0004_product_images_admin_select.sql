-- المدير يحتاج صلاحية القراءة لحذف/استبدال صور المنتجات (القراءة العامة تتم عبر الرابط العام)
create policy product_images_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
