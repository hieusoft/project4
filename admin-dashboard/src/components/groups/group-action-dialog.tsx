import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Group } from "@/types"

interface GroupActionDialogProps {
  dialogGroup: Group | null
  dialogAction: "approve" | "suspend" | "view"
  onClose: () => void
  onConfirm: () => void
}

export function GroupActionDialog({
  dialogGroup,
  dialogAction,
  onClose,
  onConfirm,
}: GroupActionDialogProps) {
  // If it's the view action, we don't render this dialog (it's handled by GroupDetailsDialog)
  if (dialogAction === "view") return null

  return (
    <Dialog
      open={!!dialogGroup && (dialogAction === "approve" || dialogAction === "suspend")}
      onOpenChange={() => onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialogAction === "approve" ? "Duyệt nhóm" : "Đình chỉ nhóm"}
          </DialogTitle>
          <DialogDescription>
            {dialogAction === "approve"
              ? `Duyệt nhóm "${dialogGroup?.name}"? Nhóm sẽ hiển thị công khai.`
              : `Đình chỉ nhóm "${dialogGroup?.name}"? Nhóm sẽ bị ẩn khỏi danh sách.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant={dialogAction === "approve" ? "default" : "destructive"}
            onClick={onConfirm}
          >
            {dialogAction === "approve" ? "Duyệt" : "Đình chỉ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
