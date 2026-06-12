import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_REPORTS_PREFIX } from './storage.constants';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly ttl: number;

  constructor(private config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
    this.ttl = Number(this.config.get('S3_SIGNED_URL_TTL') ?? 300);
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (region && this.bucket) {
      // If explicit keys are provided use them; otherwise fall back to the
      // default AWS credential chain (IAM role on the host).
      this.client = new S3Client({
        region,
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      });
    } else {
      this.client = null;
      this.logger.warn(
        'S3 not configured (AWS_REGION / AWS_S3_BUCKET missing). Report uploads via S3 will fail until set.',
      );
    }
  }

  private ensure(): S3Client {
    if (!this.client) {
      throw new InternalServerErrorException(
        'File storage (S3) is not configured.',
      );
    }
    return this.client;
  }

  /** Build a unique object key under reports/<scope>/. */
  buildKey(originalName: string, scope = 'misc'): string {
    const ext = extname(originalName).toLowerCase();
    return `${S3_REPORTS_PREFIX}/${scope}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  }

  async upload(
    body: Buffer,
    opts: { key: string; contentType?: string },
  ): Promise<string> {
    const client = this.ensure();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.key,
        Body: body,
        ContentType: opts.contentType,
      }),
    );
    return opts.key;
  }

  /** Pre-signed, time-limited GET URL for a private object. */
  async getSignedDownloadUrl(
    key: string,
    ttlSeconds?: number,
  ): Promise<string> {
    const client = this.ensure();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds ?? this.ttl },
    );
  }

  async delete(key: string): Promise<void> {
    const client = this.ensure();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
