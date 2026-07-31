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

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "member" | "moderator" | "owner";
  status: "pending" | "approved" | "rejected" | "blocked";
  joined_at: string | null;
  created_at: string;
  profile?: Profile;
}

export interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  type: string;
  ref_id: string | null;
  status: string;
  is_pinned: boolean;
  like_count: number;
  comment_count: number;
  images: Array<{
    id: string;
    image_url: string;
    sort_order: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  code: string;
  group_id: string;
  title: string;
  description: string | null;
  province_code: string | null;
  district_code: string | null;
  beneficiary_description: string | null;
  status: "active" | "fulfilled" | "closed" | "cancelled";
  deadline: string | null;
  created_by: string;
  fulfilled_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  items: CampaignItem[];
}

export interface CampaignItem {
  id: string;
  campaign_id: string;
  name: string;
  category_id: string | null;
  target_quantity: number;
  received_quantity: number;
  unit: string | null;
  condition_required: string | null;
  note: string | null;
}

export interface CampaignProgress {
  campaign_id: string;
  code: string;
  title: string;
  status: Campaign["status"];
  total_targets: number;
  fulfilled_targets: number;
  items: CampaignProgressItem[];
}

export interface CampaignProgressItem {
  id: string;
  name: string;
  target_quantity: number;
  received_quantity: number;
  remaining: number;
  unit: string | null;
  fulfilled: boolean;
}

export interface Contribution {
  id: string;
  code: string;
  campaign_id: string;
  donor_id: string;
  status: "pending" | "accepted" | "scheduled" | "received" | "completed" | "rejected" | "cancelled";
  pickup_method: "drop_off" | "pickup";
  pickup_address: string | null;
  scheduled_at: string | null;
  received_at: string | null;
  rejected_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  items: ContributionItem[];
}

export interface ContributionItem {
  id: string;
  contribution_id: string;
  campaign_item_id: string;
  name: string;
  quantity: number;
  condition_declared: string;
  condition_actual: string | null;
  check_note: string | null;
  checked_by: string | null;
  checked_at: string | null;
  status: "pending" | "accepted" | "rejected";
  reject_reason: string | null;
  images: ContributionImage[];
}

export interface ContributionImage {
  id: string;
  contribution_item_id: string;
  image_url: string;
  type: "declared" | "actual_check";
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface CampaignWithGroup extends Campaign {
  group?: Group;
}

export interface ContributionWithDonor extends Contribution {
  donorProfile?: Profile;
  campaign?: Campaign;
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
