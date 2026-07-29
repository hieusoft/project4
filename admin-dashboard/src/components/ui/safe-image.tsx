"use client"

import { useState } from "react"
import { resolveImageUrl } from "@/lib/image-url"

interface SafeImageProps {
  src: string | null | undefined
  alt: string
  fallback: React.ReactNode
  className?: string
}

export function SafeImage({ src, alt, fallback, className }: SafeImageProps) {
  const [failed, setFailed] = useState(false)
  const imageUrl = resolveImageUrl(src)

  if (!imageUrl || failed) return <>{fallback}</>

  return <img src={imageUrl} alt={alt} className={className} onError={() => setFailed(true)} />
}
