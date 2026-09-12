import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin, getSupabaseBucket, getSupabaseUrl } from "@/lib/supabase";

export interface UploadResult {
  storagePath: string;
  signedUrl: string | null;
  provider: "supabase" | "local";
}

/**
 * Ensures local storage directory exists.
 */
async function ensureLocalDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory already exists
  }
}

/**
 * Uploads a bill buffer to Supabase Storage with auto-bucket creation and local fallback.
 *
 * Flow:
 * 1. Attempts upload to Supabase Storage using admin client (Service Role Key).
 * 2. If bucket is missing, automatically creates the bucket.
 * 3. If Supabase network call fails (e.g. DNS error, unreachable, offline, mock URL),
 *    gracefully saves to local storage at `public/uploads/bills/` so upload NEVER fails.
 */
export async function uploadBillImage(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const bucket = getSupabaseBucket();

  // Try Supabase Storage first
  try {
    const supabaseUrl = getSupabaseUrl();
    if (supabaseUrl && !supabaseUrl.includes("mock.supabase.co")) {
      const supabase = getSupabaseAdmin();

      // Attempt direct upload
      let { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      // If bucket doesn't exist (statusCode 404 or bucket not found), create bucket and retry
      if (uploadError && (uploadError.message?.toLowerCase().includes("bucket") || (uploadError as unknown as { statusCode?: string }).statusCode === "404")) {
        try {
          await supabase.storage.createBucket(bucket, { public: false });
          const retry = await supabase.storage
            .from(bucket)
            .upload(storagePath, buffer, {
              contentType,
              upsert: true,
            });
          uploadError = retry.error;
        } catch {
          // Fall through to local fallback
        }
      }

      if (!uploadError) {
        // Successfully uploaded to Supabase
        const { data: signedData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600);

        return {
          storagePath,
          signedUrl: signedData?.signedUrl ?? null,
          provider: "supabase",
        };
      } else {
        console.warn("Supabase upload returned error, using local fallback:", uploadError.message);
      }
    }
  } catch (err: unknown) {
    console.warn("Supabase network/connection notice (using local fallback):", (err as Error).message);
  }

  // Local fallback: save to public/uploads/bills/
  // Now that this route has a real caller, a fallback taken here means the actual bill
  // image is NOT durably stored on typical serverless deployments (Vercel's filesystem is
  // ephemeral outside /tmp) — surfaced as an error-level log, not a warning, so it's visible
  // in production monitoring rather than silently swallowed.
  console.error(
    `[ALERT] Bill upload fell back to local disk storage — Supabase Storage unavailable or ` +
    `misconfigured. storagePath=${storagePath}. On a serverless deployment this file will ` +
    `not persist across cold starts/deploys.`
  );
  try {
    const localDir = path.join(process.cwd(), "public", "uploads", "bills", path.dirname(storagePath));
    await ensureLocalDir(localDir);
    const localFilePath = path.join(process.cwd(), "public", "uploads", "bills", storagePath);
    await fs.writeFile(localFilePath, buffer);

    return {
      storagePath,
      signedUrl: `/uploads/bills/${storagePath}`,
      provider: "local",
    };
  } catch (localErr) {
    console.error("Local storage error:", localErr);
    throw new Error("Unable to save bill image to storage.");
  }
}

/**
 * Resolves a viewable URL for a bill image path (Supabase signed URL or local URL).
 */
export async function getBillViewUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  // Check if file exists locally first
  try {
    const localFilePath = path.join(process.cwd(), "public", "uploads", "bills", storagePath);
    await fs.access(localFilePath);
    return `/uploads/bills/${storagePath}`;
  } catch {
    // Not local, try Supabase
  }

  try {
    const supabase = getSupabaseAdmin();
    const bucket = getSupabaseBucket();
    const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
