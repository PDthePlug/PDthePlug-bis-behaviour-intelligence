export const EVIDENCE_BUCKET = "bis-private-evidence";
export const MAX_EVIDENCE_IMAGES = 5;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_STORED_BYTES = 3 * 1024 * 1024;

export function validateEvidenceImage(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo or screenshot. Export HEIC images as JPG first.");
  }
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 20 MB.");
}

export function evidenceImageSize(width, height) {
  if (!(width > 0 && height > 0) || width * height > 80_000_000) throw new Error("This image is too large to prepare. Choose a smaller copy.");
  const scale = Math.min(1, 2048 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Fixed slots plus insert-only Storage policies enforce the limit across tabs.
export function nextEvidenceSlot(names) {
  for (let slot = 1; slot <= MAX_EVIDENCE_IMAGES; slot++) {
    const name = `${slot}.jpg`;
    if (!names.includes(name)) return name;
  }
  throw new Error("You have five photos attached. Remove one before adding another.");
}
