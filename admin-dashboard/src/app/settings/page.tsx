import { ModeToggle } from "@/components/mode-toggle"
import { AdminLayout } from "@/components/admin-layout"
import { Settings2, Palette, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <AdminLayout>
    <div className="admin-page max-w-5xl">
      <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Settings2 className="size-5" /></div>
          <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-muted-foreground">
          Quản lý các thiết lập chung và giao diện của bảng điều khiển.
        </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="admin-surface">
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
            <CardDescription>
              Tùy chỉnh giao diện sáng / tối cho hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2"><Palette className="size-4 text-primary" /><p className="font-medium">Chế độ màn hình</p></div>
              <p className="text-sm text-muted-foreground">
                Chuyển đổi qua lại giữa chế độ Sáng và Tối.
              </p>
            </div>
            <ModeToggle />
          </CardContent>
        </Card>

        <Card className="admin-surface">
          <CardHeader>
            <CardTitle>Bảo trì hệ thống</CardTitle>
            <CardDescription>
              Các cấu hình liên quan đến hệ thống sẽ được thêm vào đây.
            </CardDescription>
          </CardHeader>
          <CardContent>
              <div className="flex items-start gap-3 rounded-2xl border bg-muted/35 p-4">
                <Info className="mt-0.5 size-4 text-primary" />
                <p className="text-sm text-muted-foreground">Các cấu hình vận hành nâng cao sẽ được bổ sung tại đây.</p>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AdminLayout>
  )
}
