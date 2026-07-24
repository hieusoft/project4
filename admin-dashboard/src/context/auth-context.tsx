"use client"

import React, { createContext, useState, useEffect, useContext } from "react"
import { useRouter, usePathname } from "next/navigation"
import { identityApi } from "@/lib/api/client"

interface AuthContextType {
  currentUser: any
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>
  isAuthLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkLoginStatus = async () => {
      let token = localStorage.getItem("admin_token")
      const refreshToken = localStorage.getItem("admin_refresh_token")

      // Nếu không có access_token nhưng có refresh_token, thử làm mới ngay
      if (!token && refreshToken) {
        try {
          const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"
          const refreshRes = await fetch(`${base}/identity/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })
          const refreshData = await refreshRes.json()
          if (refreshRes.ok && refreshData.data?.access_token) {
            token = refreshData.data.access_token
            localStorage.setItem("admin_token", token)
            if (refreshData.data.refresh_token) {
              localStorage.setItem("admin_refresh_token", refreshData.data.refresh_token)
            }
          }
        } catch (e) {
          console.warn("Không thể tự động làm mới token lúc khởi tạo")
        }
      }

      if (!token) {
        setCurrentUser(null)
        setIsAuthLoading(false)
        if (pathname !== "/login") {
          router.replace("/login")
        }
        return
      }

      try {
        const response = await identityApi.getMe()
        const userData = response.data || response

        // Parse roles and email from JWT token payload safely
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          // Pad string with trailing '=' to make its length a multiple of 4
          const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
          
          // Use a safe decoding approach for unicode characters
          const jsonPayload = decodeURIComponent(window.atob(paddedBase64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          
          const payload = JSON.parse(jsonPayload)
          if (payload) {
            if (payload.roles) userData.roles = payload.roles
            if (payload.email) userData.email = payload.email
          }
        } catch (e) {
          console.error("Lỗi khi parse token payload:", e)
        }

        setCurrentUser(userData)
        if (pathname === "/login") {
          router.replace("/dashboard")
        }
      } catch (error: any) {
        if (error?.message?.includes("expired") || error?.message?.includes("Invalid token")) {
          console.warn("Phiên đăng nhập đã hết hạn. Đang chuyển hướng về trang đăng nhập...");
        } else {
          console.warn("Lỗi xác thực token:", error?.message || error)
        }
        localStorage.removeItem("admin_token")
        localStorage.removeItem("admin_refresh_token")
        setCurrentUser(null)
        if (pathname !== "/login") {
          router.replace("/login")
        }
      } finally {
        setIsAuthLoading(false)
      }
    }

    checkLoginStatus()
  }, [pathname, router])

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("admin_refresh_token")
      if (refreshToken) {
        await identityApi.logout({ refresh_token: refreshToken })
      }
    } catch (error) {
      console.error("Lỗi khi gọi API logout:", error)
    } finally {
      localStorage.removeItem("admin_token")
      localStorage.removeItem("admin_refresh_token")
      setCurrentUser(null)
      router.replace("/login")
    }
  }

  const value = {
    currentUser,
    setCurrentUser,
    isAuthLoading,
    logout,
  }

  // If loading, show a full screen loading indicator (excluding /login page) as a fixed overlay
  return (
    <AuthContext.Provider value={value}>
      {children}
      {isAuthLoading && pathname !== "/login" && (
        <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground font-medium">Đang tải hệ thống...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
