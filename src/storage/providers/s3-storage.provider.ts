import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { IStorageProvider } from '../storage.interface';
import { GetPresignedUrlRequestDto } from '../dto/request.dto';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private s3: S3;
  public bucketName: string;
  public region: string;
  private bucketUrl: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-1';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'artsharing';
    this.bucketUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/`;

    // Configure the S3 client
    this.s3 = new S3({
      region: this.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      signatureVersion: 'v4', // Ensure consistent signature behavior
    });
  }

  async generatePresignedUrl({
    fileName,
    extension,
    mediaType,
    directory,
  }: GetPresignedUrlRequestDto): Promise<{ url: string; key: string }> {
    const key = `${directory}/${nanoid()}_${fileName}.${extension}`;

    try {
      const url = await this.s3.getSignedUrlPromise('putObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 300, // URL valid for 5 minutes
        ContentType: `${mediaType}/${extension}`,
      });

      return { url, key };
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      throw new Error('Could not generate a pre-signed URL');
    }
  }

  async deleteFile(url: string): Promise<void> {
    if (!url.startsWith(this.bucketUrl)) {
      throw new Error(`Invalid file URL: ${url}`);
    }

    const key = url.replace(this.bucketUrl, '');

    if (!key) {
      throw new Error('Failed to extract file key from URL');
    }

    try {
      await this.s3
        .deleteObject({ Bucket: this.bucketName, Key: key })
        .promise();
    } catch (error) {
      console.error(`Error deleting file from S3 (Key: ${key}):`, error);
      throw new Error(`Failed to delete file from S3: ${key}`);
    }
  }
}
