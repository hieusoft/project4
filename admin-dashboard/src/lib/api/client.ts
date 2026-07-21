import { DataEnvelope, Paginated } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  // Add auth token if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Identity Service ───
export const identityApi = {
  health: () => request<{ service: string; status: string }>("/identity/health"),

  listAccounts: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/identity/accounts" + (qs ? `?${qs}` : ""));
  },

  lockAccount: (id: string) =>
    request<DataEnvelope<any>>(`/identity/accounts/${id}/lock`, { method: "POST" }),

  unlockAccount: (id: string) =>
    request<DataEnvelope<any>>(`/identity/accounts/${id}/unlock`, { method: "POST" }),

  getProfile: (id: string) =>
    request<DataEnvelope<any>>(`/identity/profile/${id}`),
};

// ─── Community Service ───
export const communityApi = {
  health: () => request<{ service: string; status: string }>("/community/health"),

  listGroups: (params?: {
    status?: string;
    province_code?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.province_code) searchParams.set("province_code", params.province_code);
    if (params?.q) searchParams.set("q", params.q);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/community/groups" + (qs ? `?${qs}` : ""));
  },

  getGroup: (id: string) =>
    request<DataEnvelope<any>>(`/community/groups/${id}`),

  approveGroup: (id: string) =>
    request<DataEnvelope<any>>(`/community/admin/groups/${id}/approve`, { method: "POST" }),

  suspendGroup: (id: string) =>
    request<DataEnvelope<any>>(`/community/admin/groups/${id}/suspend`, { method: "POST" }),

  listMembers: (groupId: string, params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>(`/community/groups/${groupId}/members` + (qs ? `?${qs}` : ""));
  },

  listPosts: (groupId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>(`/community/groups/${groupId}/posts` + (qs ? `?${qs}` : ""));
  },
};

// ─── Donation Service ───
export const donationApi = {
  health: () => request<{ service: string; status: string }>("/donation/health"),

  listDonations: (params?: {
    group_id?: string;
    donor_id?: string;
    status?: string;
    mine?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.donor_id) searchParams.set("donor_id", params.donor_id);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.mine) searchParams.set("mine", "true");
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/donation/donations" + (qs ? `?${qs}` : ""));
  },

  getDonation: (id: string) =>
    request<DataEnvelope<any>>(`/donation/donations/${id}`),

  listInventory: (params?: {
    group_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/donation/inventory" + (qs ? `?${qs}` : ""));
  },

  listCategories: () =>
    request<DataEnvelope<any[]>>("/donation/categories"),
};

// ─── Marketplace Service ───
export const marketplaceApi = {
  health: () => request<{ service: string; status: string }>("/marketplace/health"),

  getCatalog: (params?: {
    category_id?: string;
    province_code?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category_id) searchParams.set("category_id", params.category_id);
    if (params?.province_code) searchParams.set("province_code", params.province_code);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/marketplace/catalog" + (qs ? `?${qs}` : ""));
  },

  getListings: (params?: {
    status?: string;
    group_id?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/marketplace/listings" + (qs ? `?${qs}` : ""));
  },

  getRequests: (params?: {
    status?: string;
    group_id?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/marketplace/requests" + (qs ? `?${qs}` : ""));
  },

  getStats: (params?: { stat_date?: string; group_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.stat_date) searchParams.set("stat_date", params.stat_date);
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    const qs = searchParams.toString();
    return request<any>("/marketplace/stats" + (qs ? `?${qs}` : ""));
  },

  getOverview: (params?: { group_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    const qs = searchParams.toString();
    return request<any>("/marketplace/stats/overview" + (qs ? `?${qs}` : ""));
  },
};
