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
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-[#5c1018] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(134,239,172,0.3),transparent_26rem),radial-gradient(circle_at_85%_80%,rgba(251,191,36,0.18),transparent_24rem)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/25 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#ff8a83]/20 to-transparent p-10 text-white lg:flex">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#ffb3ac] text-[#5c1018]">
                <HandHeartIcon className="size-6" />
              </div>
              <div>
                <p className="font-bold">ChoSV Admin</p>
                <p className="text-xs text-[#ffe8e5]/70">Operations console</p>
              </div>
            </div>
            <p className="max-w-sm text-4xl font-bold leading-tight tracking-tight">
              Điều phối những kết nối tạo nên thay đổi.
            </p>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#fff5f3]/75">
              Một nơi để theo dõi cộng đồng, kiểm duyệt quyên góp và đảm bảo mọi món đồ đến đúng người.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-[#fff5f3]/75">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">Cộng đồng</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">Minh bạch</div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">Bàn giao</div>
          </div>
        </div>
        <Card className="rounded-none border-0 bg-card/95 shadow-none">
        <CardHeader className="space-y-2 pb-6 pt-8 text-center lg:pt-10">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:hidden">
            <HandHeartIcon className="size-5" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Chào mừng trở lại</CardTitle>
          <CardDescription className="text-sm">Đăng nhập vào khu vực quản trị</CardDescription>
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
        <CardFooter className="flex flex-col border-t pt-4 text-center text-xs text-muted-foreground">
          <p>© 2026 ChoSV · Kết nối thiện nguyện</p>
        </CardFooter>
      </Card>
      </div>
    </div>
  )
}
