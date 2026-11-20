import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Reads S3_* variables. Error messages name variables only, never values. */
export function storageConfigFromEnv(env: Record<string, string | undefined>): StorageConfig {
  const required = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION!,
    bucket: env.S3_BUCKET!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
  };
}

/** Object key for a page screenshot. Keys are prefixed by organisation. */
export function screenshotKey(parts: {
  orgId: string;
  scanId: string;
  pageId: string;
  viewport: string;
}): string {
  return `orgs/${parts.orgId}/scans/${parts.scanId}/pages/${parts.pageId}/${parts.viewport}.jpg`;
}

/** Object key for a generated report file, e.g. orgs/{org}/reports/{report}/report.pdf. */
export function reportFileKey(parts: { orgId: string; reportId: string; format: string }): string {
  return `orgs/${parts.orgId}/reports/${parts.reportId}/report.${parts.format}`;
}

/** Object key for an evidence file. The stored name is random; the original name is in the DB. */
export function evidenceKey(parts: { orgId: string; fileId: string; extension: string }): string {
  return `orgs/${parts.orgId}/evidence/${parts.fileId}.${parts.extension}`;
}

/** S3-compatible object storage (MinIO locally; S3 Mumbai or R2 in production). */
export function createStorage(config: StorageConfig) {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async ensureBucket(): Promise<void> {
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      }
    },

    async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    /** Returns the object bytes, or null when it does not exist. */
    async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!result.Body) return null;
        return {
          body: await result.Body.transformToByteArray(),
          contentType: result.ContentType ?? "application/octet-stream",
        };
      } catch (error) {
        if ((error as { name?: string }).name === "NoSuchKey") return null;
        throw error;
      }
    },

    /** Deletes an object; deleting a missing object is not an error. */
    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;
