export type Role = "admin" | "cashier";
export type SaleType = "weight" | "unit";
export type PaymentMethod = "cash" | "card";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  barcode: string | null;
  sale_type: SaleType;
  price: number;
  stock_qty: number;
  low_stock_threshold: number;
  show_on_display: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Settings {
  id: number;
  shop_name: string;
  shop_subtitle: string;
  vat_number: string;
  cr_number: string;
  address: string;
  phone: string;
  vat_enabled_default: boolean;
  vat_rate: number;
  prices_include_vat: boolean;
  invoice_footer: string;
  display_rotate_seconds: number;
}

export interface Invoice {
  id: string;
  invoice_no: number;
  cashier_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount: number;
  vat_enabled: boolean;
  vat_rate: number;
  prices_include_vat: boolean;
  vat_amount: number;
  total: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  change_amount: number;
  status: "paid" | "void";
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  sale_type: SaleType;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface DisplayMenu {
  shop_name: string;
  shop_subtitle: string;
  rotate_seconds: number;
  categories: {
    id: string;
    name: string;
    products: Pick<Product, "id" | "name" | "description" | "image_url" | "sale_type" | "price">[];
  }[];
}
