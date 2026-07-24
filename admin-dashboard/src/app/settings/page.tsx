import { ModeToggle } from "@/components/mode-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-muted-foreground">
          Quản lý các thiết lập chung và giao diện của bảng điều khiển.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
            <CardDescription>
              Tùy chỉnh giao diện sáng / tối cho hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Chế độ màn hình</p>
              <p className="text-sm text-muted-foreground">
                Chuyển đổi qua lại giữa chế độ Sáng và Tối.
              </p>
            </div>
            <ModeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bảo trì hệ thống</CardTitle>
            <CardDescription>
              Các cấu hình liên quan đến hệ thống sẽ được thêm vào đây.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Tính năng đang được phát triển...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
