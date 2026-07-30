"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Loader2, Upload, X, Plus, ImageIcon } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { donationApi, aiApi, mediaApi, communityApi } from "@/lib/api/client"

interface CreateDonationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

interface UploadedImage {
  media_id: string
  public_url: string
  file: File
  preview: string
}

const CONDITIONS = [
  { value: "new", label: "Mới" },
  { value: "like_new", label: "Như mới" },
  { value: "good", label: "Còn tốt" },
  { value: "used", label: "Đã dùng" },
  { value: "worn", label: "Cũ/kém" },
]

const PICKUP_METHODS = [
  { value: "drop_off", label: "Mang đến" },
  { value: "pickup", label: "Giao tận nơi" },
]

export function CreateDonationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDonationDialogProps) {
  const [groups, setGroups] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [groupId, setGroupId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pickupMethod, setPickupMethod] = useState("drop_off")
  const [pickupAddress, setPickupAddress] = useState("")
  const [itemName, setItemName] = useState("")
  const [itemCategory, setItemCategory] = useState("")
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemCondition, setItemCondition] = useState("good")
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchMeta = useCallback(async () => {
    try {
      const [groupsRes, catsRes] = await Promise.all([
        communityApi.listGroups({ limit: 100 }),
        donationApi.listCategories(),
      ])
      setGroups(groupsRes.data?.items || [])
      setCategories(catsRes.data || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (open) fetchMeta()
  }, [open, fetchMeta])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded: UploadedImage[] = []
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast.error(`${file.name}: định dạng không hỗ trợ`)
          continue
        }
        const presignRes = await mediaApi.presign({
          mime_type: file.type,
          ref_type: "donation",
          file_size: file.size,
        })
        const { media_id, upload_url, public_url } = presignRes.data
        await fetch(upload_url, { method: "PUT", body: file })
        await mediaApi.confirm(media_id)
        uploaded.push({ media_id, public_url, file, preview: URL.createObjectURL(file) })
      }
      setImages((prev) => [...prev, ...uploaded])
      toast.success(`Đã upload ${uploaded.length} ảnh`)
    } catch (err: any) {
      toast.error("Upload thất bại: " + err.message)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleAIDetect = async () => {
    if (!images.length) {
      toast.error("Vui lòng upload ảnh trước")
      return
    }
    setAiLoading(true)
    try {
      const res = await aiApi.detectItem(images[0].public_url)
      const data = (res as any)?.data ?? res
      if (data?.name) setItemName(data.name)
      if (data?.category_id) setItemCategory(data.category_id)
      else if (data?.category) {
        const found = categories.find(
          (c) => c.name?.toLowerCase().includes(data.category.toLowerCase()) || c.slug === data.category
        )
        if (found) setItemCategory(found.id)
      }
      if (data?.condition) {
        const cond = CONDITIONS.find((c) => c.value === data.condition)
        if (cond) setItemCondition(cond.value)
      }
      toast.success("AI đã điền gợi ý — kiểm tra và chỉnh sửa nếu cần")
    } catch (err: any) {
      toast.error("AI nhận diện thất bại: " + (err.message || "lỗi"))
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!groupId) { toast.error("Chọn nhóm"); return }
    if (!title.trim()) { toast.error("Nhập tiêu đề"); return }
    if (!itemName.trim()) { toast.error("Nhập tên vật phẩm"); return }
    if (!images.length) { toast.error("Cần ít nhất 1 ảnh"); return }
    setSubmitting(true)
    try {
      await donationApi.createDonation({
        group_id: groupId,
        title,
        description: description || undefined,
        pickup_method: pickupMethod,
        pickup_address: pickupMethod === "pickup" ? pickupAddress : undefined,
        items: [{
          name: itemName,
          category_id: itemCategory || undefined,
          quantity: itemQuantity,
          condition_declared: itemCondition,
          images: images.map((img) => ({
            image_url: img.public_url,
            type: "declared",
          })),
        }],
      })
      toast.success("Tạo đơn quyên góp thành công!")
      resetForm()
      onOpenChange(false)
      onCreated()
    } catch (err: any) {
      toast.error("Tạo đơn thất bại: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setGroupId("")
    setTitle("")
    setDescription("")
    setPickupMethod("drop_off")
    setPickupAddress("")
    setItemName("")
    setItemCategory("")
    setItemQuantity(1)
    setItemCondition("good")
    images.forEach((img) => URL.revokeObjectURL(img.preview))
    setImages([])
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Tạo đơn quyên góp
          </DialogTitle>
          <DialogDescription>
            Upload ảnh vật phẩm, dùng AI gợi ý hoặc tự nhập thông tin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group + title */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nhóm tiếp nhận</Label>
              <Select value={groupId} onValueChange={(v) => setGroupId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Chọn nhóm" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tiêu đề</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Quyên góp quần áo" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mô tả (tuỳ chọn)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Mô tả thêm..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phương thức</Label>
              <Select value={pickupMethod} onValueChange={(v) => setPickupMethod(v ?? "drop_off")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PICKUP_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pickupMethod === "pickup" && (
              <div className="space-y-1.5">
                <Label>Địa chỉ nhận</Label>
                <Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Địa chỉ..." />
              </div>
            )}
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>Ảnh vật phẩm</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 gap-1">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Tải ảnh</span>
                  </>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
            </div>
            {images.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Upload ảnh trước, sau đó bấm "AI nhận diện"
              </p>
            )}
          </div>

          {/* AI button — chỉ hiện khi có ảnh */}
          {images.length > 0 && (
            <Button
              variant="outline"
              onClick={handleAIDetect}
              disabled={aiLoading}
              className="w-full border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              AI nhận diện ảnh
            </Button>
          )}

          {/* Item form */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <h4 className="text-sm font-medium">Thông tin vật phẩm</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tên vật phẩm</Label>
                <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="VD: Áo khoác" />
              </div>
              <div className="space-y-1.5">
                <Label>Danh mục</Label>
                <Select value={itemCategory} onValueChange={(v) => setItemCategory(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tình trạng</Label>
                <Select value={itemCondition} onValueChange={(v) => setItemCondition(v ?? "good")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Tạo đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
