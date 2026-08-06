// ============================================================================
// FILE: src/utils/binaryDecoder.ts
// CONTEXT: Client-side decoding for live ECG/Vitals telemetry
// ============================================================================

/**
 * Decodes a Base64 string directly into a Float32Array.
 * Optimized for client-side browser performance (bypasses heavy Node Buffers).
 */
export function decodeBase64ToFloat32(base64String: string): Float32Array {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('CRITICAL: Empty or invalid Base64 telemetry payload.');
  }

  // 1. Decode Base64 to a raw binary string using the browser's native atob
  const binaryString = window.atob(base64String);
  const len = binaryString.length;

  // 2. Create a buffer and an 8-bit view to hold the raw bytes
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Cast the memory buffer to a 32-bit floating point array
  // This assumes the BLE hardware transmits little-endian floats.
  return new Float32Array(bytes.buffer);
}
