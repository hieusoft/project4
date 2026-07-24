"use client"

import { AdminLayout } from "@/components/admin-layout"
import { useEffect, useState, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { identityApi } from "@/lib/api/client" // Note: we'll use a hack to get the donationApi from client.ts
// Wait, donationApi is exported from client.ts, we should import it directly.
import { donationApi } from "@/lib/api/client"
import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PackageOpenIcon, PrinterIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_stock: { label: "Trong kho", variant: "default" },
  listed: { label: "Đã lên kệ", variant: "secondary" },
  reserved: { label: "Đã đặt trước", variant: "outline" },
  delivered: { label: "Đã giao", variant: "secondary" },
  discarded: { label: "Loại bỏ", variant: "destructive" },
}

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [qrItem, setQrItem] = useState<any | null>(null)
  const limit = 20

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await donationApi.getInventory({ page, limit })
      setItems(res.data.items || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách kho: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const totalPages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <PackageOpenIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quản lý Kho hàng</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý các sản phẩm đã nhập kho và in mã QR code
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách sản phẩm</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã Hàng</TableHead>
                  <TableHead>Tên Sản Phẩm</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead>Tình Trạng</TableHead>
                  <TableHead>Ngày Nhập</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <PackageOpenIcon className="h-8 w-8" />
                        <p>Kho hàng đang trống</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium">
                        {item.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[item.status]?.variant || "secondary"}>
                          {statusConfig[item.status]?.label || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.condition === "new" ? "Mới" :
                         item.condition === "like_new" ? "Như mới" :
                         item.condition === "good" ? "Tốt" :
                         item.condition === "used" ? "Đã sử dụng" : "Cũ"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.imported_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQrItem(item)}
                          className="gap-2"
                        >
                          <PrinterIcon className="h-4 w-4" />
                          <span>In QR</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {total > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!qrItem} onOpenChange={() => setQrItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Mã QR Sản Phẩm</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              {qrItem && (
                <QRCodeSVG
                  value={qrItem.code}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            
            <div className="text-center space-y-1">
              <p className="font-mono text-lg font-bold tracking-wider">{qrItem?.code}</p>
              <p className="text-sm font-medium">{qrItem?.name}</p>
              <p className="text-xs text-muted-foreground pt-2">
                Quét mã này bằng ứng dụng Charity Platform để thực hiện thao tác tiếp nhận / trao tặng.
              </p>
            </div>
            
            <Button className="w-full gap-2" onClick={() => window.print()}>
              <PrinterIcon className="h-4 w-4" />
              In Nhãn Sản Phẩm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
