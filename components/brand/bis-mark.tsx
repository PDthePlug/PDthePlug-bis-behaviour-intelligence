import Image from "next/image";

/** Decorative mark: the adjacent wordmark or link label supplies its name. */
export function BisMark() {
  return <Image className="bis-brand-image" src="/brand/bis-icon-192.png" width={64} height={64} alt="" aria-hidden="true" unoptimized />;
}
