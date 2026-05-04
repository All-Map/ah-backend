import { Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  private sanitizeFilename(filename: string): string {
    return filename
      .normalize('NFKD') // normalize Unicode
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // replace invalid chars with "_"
  }

  // Add this method to get public URL (Cloudinary returns full URL, so we just return it)
  getPublicUrl(bucketName: string, filePath: string): string {
    return filePath; // In Cloudinary context, we store the full URL
  }

  async uploadFile(bucketName: string, file: import('multer').File): Promise<string> {
    try {
      this.logger.log(`Uploading file to Cloudinary: ${file.originalname}`);
      const resultUrl = await this.cloudinaryService.uploadImage(file);
      return resultUrl;
    } catch (error) {
      this.logger.error(`File upload error: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(bucketName: string, filePath: string): Promise<void> {
    try {
      const publicId = this.cloudinaryService.extractPublicId(filePath);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId);
      }
    } catch (error) {
      this.logger.error(`File deletion failed: ${error.message}`);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }
}