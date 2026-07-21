export interface Account {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: "unverified" | "active" | "locked" | "deleted";
  email_verified: boolean;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  address: string | null;
  province_code: string | null;
  district_code: string | null;
  owner_id: string;
  status: "pending" | "active" | "suspended" | "closed";
  allow_member_post: boolean;
  require_post_review: boolean;
  member_count: number;
  reputation_score: number;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  code: string;
  donor_id: string;
  group_id: string;
  title: string;
  description: string;
  status:
    | "pending"
    | "accepted"
    | "scheduled"
    | "received"
    | "completed"
    | "rejected"
    | "cancelled";
  pickup_method: "drop_off" | "pickup";
  pickup_address: string | null;
  scheduled_at: string | null;
  received_at: string | null;
  rejected_reason: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  items: DonationItem[];
}

export interface DonationItem {
  id: string;
  name: string;
  category_id: string;
  quantity: number;
  condition_declared: string;
  condition_actual: string | null;
  check_note: string | null;
  checked_by: string | null;
  checked_at: string | null;
  status: "pending" | "accepted" | "rejected";
  reject_reason: string | null;
}

export interface InventoryItem {
  id: string;
  code: string;
  group_id: string;
  donation_item_id: string;
  donor_id: string;
  name: string;
  category_id: string;
  quantity: number;
  condition: string;
  status: "in_stock" | "listed" | "reserved" | "delivered" | "discarded";
  note: string | null;
  imported_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  inventory_item_id: string;
  group_id: string;
  title: string;
  description: string;
  category_id: string;
  condition: string;
  quantity_total: number;
  quantity_available: number;
  province_code: string | null;
  district_code: string | null;
  status: "active" | "reserved" | "closed" | "blocked";
  view_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  images: ListingImage[];
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  sort_order: number;
}

export interface ItemRequest {
  id: string;
  code: string;
  listing_id: string;
  group_id: string;
  receiver_id: string;
  quantity: number;
  reason: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "scheduled"
    | "completed"
    | "cancelled"
    | "no_show";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  province_code: string | null;
  district_code: string | null;
  bio: string | null;
  reputation_score: number;
  donation_count: number;
  received_count: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  ref_type: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DailyStat {
  id: string;
  stat_date: string;
  group_id: string | null;
  donations_count: number;
  items_received: number;
  items_listed: number;
  items_delivered: number;
  requests_count: number;
  people_helped: number;
  new_users: number;
  new_members: number;
}

export interface Paginated<T> {
  items: T[];
  meta: {
    total: number;
    page?: number;
    limit?: number;
    offset?: number;
  };
}

export interface DataEnvelope<T> {
  data: T;
}
