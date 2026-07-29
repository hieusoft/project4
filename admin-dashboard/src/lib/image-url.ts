const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "")

export function resolveImageUrl(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? ""
  if (!raw) return null

  const parsed = URL.canParse(raw) ? new URL(raw) : null
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) return null

  // Media-service may persist localhost URLs. Replace only when the dashboard
  // has an explicit public media origin configured for the current environment.
  if (mediaBaseUrl && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    const mediaPath = parsed.pathname.replace(/^\/media\/?/, "")
    return `${mediaBaseUrl}/${mediaPath}${parsed.search}`
  }

  return parsed.toString()
}
