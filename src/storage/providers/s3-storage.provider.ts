import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { TryCatch } from 'src/common/try-catch.decorator';
import { GetPresignedUrlRequestDto } from '../dto/request.dto';
import { GetPresignedUrlResponseDto } from '../dto/response.dto';
import { IStorageProvider } from '../storage.interface';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private s3: S3;
  private bucketName: string;
  private region: string;
  private bucketUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.region =
      this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'artsharing';
    this.bucketUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/`;

    // Configure the S3 client
    this.s3 = new S3({
      region: this.region,
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      signatureVersion: 'v4', // Ensure consistent signature behavior
    });
  }

  async generatePresignedUrl({
    fileName,
    extension,
    mediaType,
    directory,
  }: GetPresignedUrlRequestDto): Promise<GetPresignedUrlResponseDto> {
    const key = `${directory}/${fileName}.${extension}`;
    const fileUrl = `${this.bucketUrl}${key}`;

    try {
      const presignedUrl = await this.s3.getSignedUrlPromise('putObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 300, // URL valid for 5 minutes
        ContentType: `${mediaType}/${extension}`,
      });

      return { presignedUrl, fileUrl };
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      throw new Error('Could not generate a pre-signed URL');
    }
  }

  @TryCatch()
  async deleteFiles(urls: string[]): Promise<void> {
    const objectsToDelete = urls.map((url) => {
      if (!url.startsWith(this.bucketUrl)) {
        throw new Error(`Invalid file URL: ${url}`);
      }
      const key = url.replace(this.bucketUrl, '');
      if (!key) {
        throw new Error('Failed to extract file key from URL');
      }
      return { Key: key };
    });

    const params = {
      Bucket: this.bucketName,
      Delete: {
        Objects: objectsToDelete,
        Quiet: false, // If set to true, S3 doesn't return a list of deleted objects
      },
    };

    await this.s3.deleteObjects(params).promise();
  }

  @TryCatch('Failed to upload images')
  async uploadFiles(
    files: Express.Multer.File[],
    directory: string,
  ): Promise<{ url: string; key: string }[]> {
    const uploadPromises = files.map((file) => {
      const key = `${directory}/${nanoid()}_${file.originalname}`;

      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      return this.s3
        .upload(params)
        .promise()
        .then((data) => {
          return { url: data.Location, key };
        });
    });

    // Wait for all files to upload
    const uploadedFiles = await Promise.all(uploadPromises);
    return uploadedFiles;
  }

  getBucketUrl(): string {
    return this.bucketUrl;
  }
}
