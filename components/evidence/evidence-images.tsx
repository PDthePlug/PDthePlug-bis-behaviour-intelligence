"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./evidence-images.css";
import { createClient } from "@/lib/supabase/client";
import { EVIDENCE_BUCKET, MAX_STORED_BYTES, validateEvidenceImage, evidenceImageSize, nextEvidenceSlot } from "@/lib/evidence-images.mjs";

async function prepareImage(file: File) {
  validateEvidenceImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const size = evidenceImageSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare this photo.")), "image/jpeg", 0.85));
    if (blob.size > MAX_STORED_BYTES) throw new Error("This photo is still too large. Choose a smaller copy.");
    return blob;
  } finally { bitmap.close(); }
}

export function EvidenceImages({ enrollmentId, onBlockedChange }: { enrollmentId: string; onBlockedChange: (blocked: boolean) => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [client] = useState(createClient);
  const lock = useRef(false);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    onBlockedChange(busy || !!pending);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    if (busy || pending) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, pending, onBlockedChange]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function scope() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error("Please sign in again to manage your photos.");
    return `${data.user.id}/${enrollmentId}`;
  }
  async function list(prefix: string) {
    const { data, error } = await client.storage.from(EVIDENCE_BUCKET).list(prefix, { limit: 10, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("Could not load your attachments. Check your connection and retry.");
    return data.filter((item) => /^[1-5]\.jpg$/.test(item.name)).map((item) => item.name);
  }
  async function refresh() {
    try {
      const names = await list(await scope());
      if (mounted.current) { setItems(names); setLoaded(true); if (!pending) setError(""); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Could not load photos."); }
  }
  // refresh only updates state after authenticated asynchronous Storage reads.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); /* scope is fixed for this keyed enrolment */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId]);

  async function upload(file: File) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setPending(file); setError(""); setStatus("Preparing and uploading photo…");
    try {
      const blob = await prepareImage(file);
      const prefix = await scope();
      const names = await list(prefix);
      const name = nextEvidenceSlot(names);
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(`${prefix}/${name}`, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "0" });
      if (error) throw new Error("Photo upload was not confirmed. Check your connection, reload attachments, and retry if it is missing.");
      setItems([...names, name].sort()); setLoaded(true); setPending(null); setStatus("Photo saved privately.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Photo was not saved. Please retry."); setStatus("");
    } finally { setBusy(false); lock.current = false; }
  }
  async function manage(name: string, remove: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      const path = `${await scope()}/${name}`;
      if (remove) {
        const { data, error } = await client.storage.from(EVIDENCE_BUCKET).remove([path]);
        if (error || !data?.length) throw new Error("Removal was not confirmed. Reload attachments and try again.");
        setItems((items) => items.filter((item) => item !== name)); setPreview(null); setStatus("Photo removed.");
      } else {
        const { data, error } = await client.storage.from(EVIDENCE_BUCKET).download(path);
        if (error || !data) throw new Error("Could not open this photo. Please retry.");
        setPreview(URL.createObjectURL(data));
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Please retry."); }
    finally { setBusy(false); lock.current = false; }
  }

  return <section className="evidence-images" aria-label="Optional evidence photos" aria-busy={busy}>
    <strong>Attach a photo or screenshot</strong>
    <p>Optional · Up to 5 images · JPG, PNG or WebP, up to 20 MB each. Photos are resized and location metadata is removed. Only you can open them.</p>
    <div className="evidence-image-actions">
      <Button type="button" variant="outline" disabled={busy || !!pending || !loaded || items.length >= 5} onClick={() => camera.current?.click()}><Camera /> Take photo</Button>
      <Button type="button" variant="outline" disabled={busy || !!pending || !loaded || items.length >= 5} onClick={() => picker.current?.click()}><Upload /> Choose image</Button>
    </div>
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    {!loaded && !error && <p role="status">Loading attachments…</p>}
    {items.length > 0 && <ul>{items.map((name) => <li key={name}><Button type="button" variant="outline" disabled={busy} onClick={() => void manage(name, false)}>View photo {name[0]}</Button><Button type="button" variant="ghost" disabled={busy} aria-label={`Remove photo ${name[0]}`} onClick={() => void manage(name, true)}><Trash2 /> Remove</Button></li>)}</ul>}
    {preview && <div>{/* Private object URL: never pass learner evidence through an image CDN. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="Your attached evidence" /><Button type="button" variant="ghost" onClick={() => setPreview(null)}>Close photo</Button></div>}
    {status && <p role="status">{status}</p>}
    {error && <div role="alert"><p>{error}</p><div className="evidence-image-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>Reload attachments</Button>{pending && <><Button type="button" disabled={busy} onClick={() => void upload(pending)}>Retry upload</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setPending(null); setError(""); setStatus("Selected photo dismissed. You can continue without adding it."); }}>Dismiss selected photo</Button></>}</div></div>}
  </section>;
}
