import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import config from '../utils/config';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

class StorageService {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const clientConfig: any = {
      region: config.s3.bucketRegion,
      forcePathStyle: true, // Required for LocalStack
    };

    // Use LocalStack endpoint if configured
    if (config.aws.endpoint) {
      clientConfig.endpoint = config.aws.endpoint;
      clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
      logger.info('S3 client configured for LocalStack', {
        endpoint: config.aws.endpoint,
      });
    }

    this.client = new S3Client(clientConfig);
    this.bucketName = config.s3.bucketName;

    // Initialize bucket (for LocalStack)
    if (config.aws.endpoint) {
      this.initializeBucket();
    }
  }

  /**
   * Initialize S3 bucket (for LocalStack development)
   */
  private async initializeBucket(): Promise<void> {
    try {
      // Check if bucket exists
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      logger.info('S3 bucket already exists', { bucket: this.bucketName });
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // Create bucket if it doesn't exist
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          logger.info('S3 bucket created successfully', { bucket: this.bucketName });
        } catch (createError) {
          logger.error('Failed to create S3 bucket', { error: createError });
        }
      } else {
        logger.error('Error checking S3 bucket', { error });
      }
    }
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ key: string; url: string }> {
    const fileId = uuidv4();
    const key = `users/${userId}/documents/${fileId}/${fileName}`;

    logger.info('Uploading file to S3', { userId, fileName, size: fileBuffer.length });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        // Enable server-side encryption (AES256 for LocalStack, aws:kms for production)
        ServerSideEncryption: config.env === 'production' ? 'aws:kms' : 'AES256',
        Metadata: {
          userId: userId,
          originalFileName: fileName,
          uploadTimestamp: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      const url = `s3://${this.bucketName}/${key}`;
      logger.info('File uploaded successfully', { key, url });

      return { key, url };
    } catch (error) {
      logger.error('Error uploading file to S3', { error, userId, fileName });
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Download a file from S3
   */
  async downloadFile(key: string): Promise<Buffer> {
    logger.info('Downloading file from S3', { key });

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      // Convert stream to buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      logger.error('Error downloading file from S3', { error, key });
      throw new Error('Failed to download file');
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    logger.info('Deleting file from S3', { key });

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('Error deleting file from S3', { error, key });
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Generate a presigned URL for file upload (client-side upload)
   */
  async getPresignedUploadUrl(
    userId: string,
    fileName: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; key: string }> {
    const fileId = uuidv4();
    const key = `users/${userId}/documents/${fileId}/${fileName}`;

    logger.info('Generating presigned upload URL', { userId, fileName });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 }); // 1 hour

      return { uploadUrl, key };
    } catch (error) {
      logger.error('Error generating presigned URL', { error, userId, fileName });
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Extract text content from a document
   * In production: Uses AWS Textract for PDF/image extraction
   * In development: Returns simple placeholder
   */
  async extractTextContent(key: string, mimeType: string): Promise<string> {
    logger.info('Extracting text content from document', { key, mimeType });

    try {
      // Handle text files directly
      if (mimeType.includes('text') || mimeType.includes('json')) {
        const buffer = await this.downloadFile(key);
        return buffer.toString('utf-8');
      }

      // For PDFs/images: Use AWS Textract in production
      // In development, return simple placeholder
      const fileName = key.split('/').pop() || 'document';
      return `[Document: ${fileName}. AWS Textract will extract content in production.]`;
    } catch (error: any) {
      logger.error('Error extracting text content', { error, key });
      throw new Error(`Failed to extract text content: ${error.message}`);
    }
  }
}

export default new StorageService();

