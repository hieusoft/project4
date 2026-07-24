import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Bell, Check, CheckCheck, Package, Users, ShoppingBag } from "lucide-react"

interface NotificationListProps {
  notifications: any[]
  loading: boolean
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
}

export function NotificationList({
  notifications,
  loading,
  onMarkAsRead,
  onMarkAllAsRead
}: NotificationListProps) {
  const getIcon = (type: string) => {
    if (type?.includes("group")) return <Users className="h-4 w-4 text-emerald-500" />
    if (type?.includes("donation")) return <Package className="h-4 w-4 text-orange-500" />
    if (type?.includes("marketplace") || type?.includes("listing")) return <ShoppingBag className="h-4 w-4 text-purple-500" />
    return <Bell className="h-4 w-4 text-blue-500" />
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <CardTitle>Hộp thư thông báo</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} chưa đọc
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>Bạn chưa có thông báo nào.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`flex gap-4 p-4 rounded-lg border transition-colors ${
                  notif.is_read ? 'bg-background' : 'bg-muted/30 border-primary/20'
                }`}
              >
                <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${notif.is_read ? 'bg-muted' : 'bg-primary/10'}`}>
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <p className={`text-sm font-medium ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(notif.created_at).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.content}</p>
                </div>

                {!notif.is_read && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="flex-shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => onMarkAsRead(notif.id)}
                    title="Đánh dấu đã đọc"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
