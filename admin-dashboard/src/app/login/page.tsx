"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { identityApi } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { HandHeartIcon, LockIcon, MailIcon, PhoneIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [show2FA, setShow2FA] = useState(false)
  const [challengeToken, setChallengeToken] = useState("")
  const [otp, setOtp] = useState("")
  const router = useRouter()
  const { setCurrentUser } = useAuth()

  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (token) {
      router.replace("/dashboard")
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier || !password) {
      toast.error("Vui lòng nhập đầy đủ tài khoản và mật khẩu")
      return
    }

    setIsLoading(true)
    setErrorMsg("")

    try {
      const isEmail = identifier.includes("@")
      const isPhone = /^[+]?[0-9]{9,15}$/.test(identifier)
      const payload: Record<string, string> = { password }

      if (isEmail) {
        payload.email = identifier
      } else if (isPhone) {
        payload.phone = identifier
      } else {
        payload.username = identifier
      }

      const response = await identityApi.login(payload)
      const data = response.data || response

      if (data.two_factor_required || data.challenge_token) {
        toast.info("Vui lòng nhập mã xác thực 2 lớp (OTP).")
        setChallengeToken(data.challenge_token || "")
        setShow2FA(true)
        return
      }

      const accessToken = data.access_token || data.accessToken
      const refreshToken = data.refresh_token || data.refreshToken

      if (!accessToken) {
        throw new Error("Không nhận được token truy cập từ hệ thống")
      }

      localStorage.setItem("admin_token", accessToken)
      if (refreshToken) {
        localStorage.setItem("admin_refresh_token", refreshToken)
      }

      const profileRes = await identityApi.getMe()
      const userData = profileRes.data || profileRes

      try {
        const tokenPayload = JSON.parse(atob(accessToken.split(".")[1]))
        if (tokenPayload) {
          if (tokenPayload.roles) userData.roles = tokenPayload.roles
          if (tokenPayload.email) userData.email = tokenPayload.email
        }
      } catch (e) {
        console.error("Lỗi parse JWT:", e)
      }

      const roles = userData.roles || []
      if (!roles.some((r: string) => ["PLATFORM_ADMIN", "ADMIN", "admin"].includes(r))) {
        throw new Error("Tài khoản của bạn không có quyền truy cập trang quản trị")
      }

      setCurrentUser(userData)
      toast.success("Đăng nhập thành công!")
      router.replace("/dashboard")
    } catch (err: any) {
      console.error("Login error:", err)
      const msg = err.message || "Tài khoản hoặc mật khẩu không chính xác"
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp) {
      toast.error("Vui lòng nhập mã OTP")
      return
    }

    setIsLoading(true)
    setErrorMsg("")

    try {
      const response = await identityApi.verify2FA({
        challenge_token: challengeToken,
        code: otp,
      })
      const data = (response as any).data || response

      const accessToken = data.access_token || data.accessToken
      const refreshToken = data.refresh_token || data.refreshToken

      if (!accessToken) {
        throw new Error("Không nhận được token truy cập từ hệ thống")
      }

      localStorage.setItem("admin_token", accessToken)
      if (refreshToken) {
        localStorage.setItem("admin_refresh_token", refreshToken)
      }

      const profileRes = await identityApi.getMe()
      const userData = (profileRes as any).data || profileRes

      try {
        const tokenPayload = JSON.parse(atob(accessToken.split(".")[1]))
        if (tokenPayload) {
          if (tokenPayload.roles) userData.roles = tokenPayload.roles
          if (tokenPayload.email) userData.email = tokenPayload.email
        }
      } catch (err) {
        console.error("Lỗi parse JWT:", err)
      }

      const roles = userData.roles || []
      if (!roles.some((r: string) => ["PLATFORM_ADMIN", "ADMIN", "admin"].includes(r))) {
        throw new Error("Tài khoản của bạn không có quyền truy cập trang quản trị")
      }

      setCurrentUser(userData)
      toast.success("Đăng nhập thành công!")
      router.replace("/dashboard")
    } catch (err: any) {
      console.error("2FA Verify error:", err)
      const msg = err.message || "Mã OTP không chính xác"
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <HandHeartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Đăng nhập Admin</CardTitle>
          <CardDescription className="text-sm">
            Hệ thống kết nối thiện nguyện & gian hàng 0 đồng
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!show2FA ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Tài khoản</Label>
                <div className="relative">
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Username, Email hoặc Số điện thoại"
                    className="pl-10 h-11"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isLoading}
                    autoComplete="username"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    {identifier.includes("@") ? (
                      <MailIcon className="h-4 w-4" />
                    ) : /^[+]?[0-9]/.test(identifier) ? (
                      <PhoneIcon className="h-4 w-4" />
                    ) : (
                      <UserIcon className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <LockIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50">
                  {errorMsg}
                </div>
              )}
              <Button type="submit" className="w-full h-11 mt-2" disabled={isLoading}>
                {isLoading ? "Đang xác thực..." : "Đăng nhập"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">Mã xác thực (OTP)</Label>
                <div className="relative">
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Nhập mã 6 số từ ứng dụng Authenticator"
                    className="pl-10 h-11 text-center tracking-widest text-lg"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    disabled={isLoading}
                    autoComplete="one-time-code"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <LockIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50">
                  {errorMsg}
                </div>
              )}
              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" className="w-full h-11" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? "Đang kiểm tra..." : "Xác nhận OTP"}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={() => {
                    setShow2FA(false)
                    setOtp("")
                    setChallengeToken("")
                  }}
                >
                  Quay lại
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
          <p>© 2026 Charity Connection. All rights reserved.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
