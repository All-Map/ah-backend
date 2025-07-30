// import { Injectable } from '@nestjs/common';
// import { SupabaseService } from 'src/supabase/supabase.service';

// @Injectable()
// export class FileUploadService {
//   constructor(private readonly supabase: SupabaseService) {}

//   async uploadFile(bucket: string, file: import('multer').File): Promise<string> {
//     const filePath = `${Date.now()}-${file.originalname}`;
//     const { data, error } = await this.supabase.client.storage
//       .from(bucket)
//       .upload(filePath, file.buffer);

//     if (error) throw new Error(`File upload failed: ${error.message}`);
//     return data.path;
//   }
// }

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly supabase: SupabaseService) {}

// Add this method to get public URL
getPublicUrl(bucketName: string, filePath: string): string {
  const { data } = this.supabase.client
    .storage
    .from(bucketName)
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// Modify uploadFile method:
async uploadFile(bucketName: string, file: import('multer').File): Promise<string> {
  try {
    await this.ensureBucketExists(bucketName);
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await this.supabase.client
      .storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) throw new Error(`File upload failed: ${error.message}`);
    
    return filePath; // Return the path only, not the full URL
  } catch (error) {
    this.logger.error(`File upload error: ${error.message}`);
    throw error;
  }
}

  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await this.supabase.client
        .storage
        .listBuckets();

      if (listError) {
        this.logger.error(`Error listing buckets: ${listError.message}`);
        throw new Error(`Error checking buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);

      if (!bucketExists) {
        // Create bucket
        const { error: createError } = await this.supabase.client
          .storage
          .createBucket(bucketName, {
            public: true, // Set to true if you want public access
            allowedMimeTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
          });

        if (createError) {
          this.logger.error(`Error creating bucket: ${createError.message}`);
          throw new Error(`Error creating bucket: ${createError.message}`);
        }

        this.logger.log(`Created bucket: ${bucketName}`);
      }
    } catch (error) {
      this.logger.error(`Bucket management error: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(bucketName: string, filePath: string): Promise<void> {
    const { error } = await this.supabase.client
      .storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      this.logger.error(`File deletion failed: ${error.message}`);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }
}