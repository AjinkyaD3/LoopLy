import sharp from "sharp";

const HASH_SIZE = 8; // 8x8 grid -> 64-bit dHash
export const DUPLICATE_HAMMING_THRESHOLD = 4; // out of 64 bits — see rationale in PLAN-V2/session notes

/**
 * Computes a 64-bit difference hash (dHash) of an image buffer, returned as a 16-char hex
 * string. Robust to minor recompression/resize/crop — the realistic "same bill re-uploaded"
 * fraud case — unlike a cryptographic hash of the raw bytes, which only catches literal
 * byte-identical re-uploads.
 */
export async function computeBillImageHash(buffer: Buffer): Promise<string> {
  // (HASH_SIZE + 1) columns so each pixel has a right neighbor to diff against.
  const { data } = await sharp(buffer)
    .resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let row = 0; row < HASH_SIZE; row++) {
    for (let col = 0; col < HASH_SIZE; col++) {
      const left = data[row * (HASH_SIZE + 1) + col];
      const right = data[row * (HASH_SIZE + 1) + col + 1];
      bits += left < right ? "1" : "0";
    }
  }

  // Pack the 64-bit string into 16 hex characters.
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two same-length hex-encoded bit hashes. */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
    distance += xor.toString(2).split("1").length - 1;
  }
  return distance;
}

export function isNearDuplicateHash(hashA: string, hashB: string): boolean {
  return hammingDistance(hashA, hashB) <= DUPLICATE_HAMMING_THRESHOLD;
}
