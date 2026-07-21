"use client"

import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  Mail,
  MessageSquare,
  HeartHandshake,
  Clock,
  CheckCircle2,
} from "lucide-react"

const channels = [
  {
    title: "Email (Brevo)",
    icon: Mail,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    status: "Hoạt động",
    description: "Xác minh tài khoản, đặt lại mật khẩu, thông báo đơn hàng",
    protocol: "Brevo SMTP API",
  },
  {
    title: "Push Notification",
    icon: Bell,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950",
    status: "Hoạt động",
    description: "Thông báo real-time trên thiết bị di động",
    protocol: "Firebase Cloud Messaging",
  },
  {
    title: "Chat",
    icon: MessageSquare,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950",
    status: "Hoạt động",
    description: "Trò chuyện giữa người quyên góp và nhóm thiện nguyện",
    protocol: "Socket.IO",
  },
  {
    title: "Events",
    icon: HeartHandshake,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950",
    status: "Hoạt động",
    description: "27 event types across 6 domains",
    protocol: "RabbitMQ — charity.events",
  },
  {
    title: "Nhắc lịch hẹn",
    icon: Clock,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950",
    status: "Hoạt động",
    description: "Tự động nhắc trước 2 giờ giờ hẹn, chạy mỗi 5 phút",
    protocol: "Background scheduler",
  },
]

export default function NotificationsPage() {
  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Thông báo & Liên lạc</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý thông báo và kênh liên lạc
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <Card key={ch.title} className="@container/card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 ${ch.bg}`}>
                    <ch.icon className={`h-4 w-4 ${ch.color}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{ch.status}</span>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{ch.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mb-2">{ch.protocol}</Badge>
                <p className="text-sm text-muted-foreground">
                  {ch.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
