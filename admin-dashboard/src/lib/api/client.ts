import { DataEnvelope, Paginated } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Tự động làm mới Token (Auto Refresh) khi bị lỗi 401 Unauthorized
  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    const refreshToken = localStorage.getItem("admin_refresh_token");
    if (refreshToken) {
      let newAccessToken = "";

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE_URL}/identity/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          const refreshData = await refreshRes.json();
          if (refreshRes.ok && refreshData.data?.access_token) {
            newAccessToken = refreshData.data.access_token;
            localStorage.setItem("admin_token", newAccessToken);
            if (refreshData.data.refresh_token) {
              localStorage.setItem("admin_refresh_token", refreshData.data.refresh_token);
            }
            onRefreshed(newAccessToken);
          } else {
            // Lỗi làm mới, có thể refresh_token cũng đã hết hạn
            onRefreshed("");
          }
        } catch (e) {
          onRefreshed("");
        } finally {
          isRefreshing = false;
        }
      } else {
        // Đợi token mới (nếu đang có request khác làm mới)
        newAccessToken = await new Promise<string>((resolve) => {
          addRefreshSubscriber((token) => resolve(token));
        });
      }

      // Thử lại request gốc với token mới
      if (newAccessToken) {
        headers["Authorization"] = `Bearer ${newAccessToken}`;
        res = await fetch(`${BASE_URL}${path}`, {
          ...options,
          headers,
        });
      }
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    
    // Handle FastAPI validation errors (422) which return an array in `detail` or `details`
    const detailsArray = error.details || error.detail
    if (detailsArray && Array.isArray(detailsArray)) {
      const msgs = detailsArray.map((err: any) => {
        if (err.loc?.includes("email")) return "Địa chỉ email không hợp lệ (không hỗ trợ tên miền .local)"
        if (err.loc?.includes("password")) return "Mật khẩu không hợp lệ (cần ít nhất 8 ký tự)"
        return `${err.loc?.join(".")}: ${err.msg}`
      }).join(", ")
      throw new Error(msgs || "Dữ liệu nhập vào không hợp lệ")
    }
    
    // Handle cases where the message is an object
    let errorMsg = error.message || error.error || `HTTP ${res.status}`
    if (typeof errorMsg === 'object') {
      errorMsg = JSON.stringify(errorMsg)
    }
    
    throw new Error(errorMsg);
  }

  return res.json();
}

// ─── Identity Service ───
export const identityApi = {
  health: () => request<{ service: string; status: string }>("/identity/health"),

  login: (payload: { username?: string; email?: string; phone?: string; password?: string }) =>
    request<any>("/identity/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: (payload: { refresh_token: string }) =>
    request<any>("/identity/auth/logout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () =>
    request<DataEnvelope<any>>("/identity/profile/me"),

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

  setMemberRole: (groupId: string, userId: string, role: string) =>
    request<DataEnvelope<any>>(`/community/groups/${groupId}/members/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  listPosts: (groupId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>(`/community/groups/${groupId}/posts` + (qs ? `?${qs}` : ""));
  },

  deletePost: (postId: string) =>
    request<DataEnvelope<any>>(`/community/posts/${postId}`, {
      method: "DELETE",
    }),
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

  getDonationTimeline: (id: string) =>
    request<DataEnvelope<any[]>>(`/donation/donations/${id}/timeline`),

  getInventory: (params?: { page?: number; limit?: number; group_id?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("offset", String((params.page - 1) * (params.limit || 20)));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.status) searchParams.set("status", params.status);
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/donation/inventory" + (qs ? `?${qs}` : ""));
  },
    
  getInventoryItem: (id: string) =>
    request<DataEnvelope<any>>(`/donation/inventory/${id}`),

  reviewDonation: (id: string, action: "accepted" | "rejected", note?: string) =>
    request<DataEnvelope<any>>(`/donation/donations/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ action, review_note: note }),
    }),

  scheduleDonation: (id: string, scheduled_at: string) =>
    request<DataEnvelope<any>>(`/donation/donations/${id}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ scheduled_at }),
    }),

  cancelDonation: (id: string) =>
    request<DataEnvelope<any>>(`/donation/donations/${id}/cancel`, {
      method: "PUT",
    }),

  checkItem: (donationId: string, itemId: string, status: string, notes?: string) =>
    request<DataEnvelope<any>>(`/donation/donations/${donationId}/items/${itemId}/check`, {
      method: "PUT",
      body: JSON.stringify({ status, condition_notes: notes }),
    }),

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
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/marketplace/listings" + (qs ? `?${qs}` : ""));
  },

  getListing: (id: string) =>
    request<DataEnvelope<any>>(`/marketplace/listings/${id}`),

  closeListing: (id: string, reason?: string) =>
    request<DataEnvelope<any>>(`/marketplace/listings/${id}/close`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),

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

  getStats: (params?: { stat_date?: string; group_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.stat_date) searchParams.set("stat_date", params.stat_date);
    if (params?.group_id) searchParams.set("group_id", params.group_id);
    if (params?.limit) searchParams.set("limit", String(params.limit));
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

// ─── Communication Service ───
export const communicationApi = {
  health: () => request<{ service: string; status: string }>("/communication/health"),

  getNotifications: (params?: { page?: number; limit?: number; unread_only?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.unread_only) searchParams.set("unread_only", "true");
    const qs = searchParams.toString();
    return request<DataEnvelope<Paginated<any>>>("/communication/notifications" + (qs ? `?${qs}` : ""));
  },

  markAsRead: (id: string) =>
    request<DataEnvelope<any>>(`/communication/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markAllAsRead: () =>
    request<DataEnvelope<any>>("/communication/notifications/read-all", {
      method: "POST",
    }),
};

