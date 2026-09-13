/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- This declaration must mirror TypeScript's lib.dom ReadableStream generic exactly. */
// TypeScript's DOM declarations currently model DecompressionStream.writable as
// WritableStream<BufferSource>, while fetch Response.body is ReadableStream<Uint8Array>.
// Browsers accept this byte stream at runtime. This narrow overload preserves the
// existing learning-portal behaviour while resolving the DOM generic mismatch.

export {};

declare global {
  interface ReadableStream<R = any> {
    pipeThrough(
      transform: DecompressionStream,
      options?: StreamPipeOptions,
    ): ReadableStream<Uint8Array>;
  }
}
