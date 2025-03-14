import { Module, OnModuleInit } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule } from '@nestjs/config'; // If using environment variables
import * as admin from 'firebase-admin';  // Firebase Admin SDK
import { PrismaService } from 'src/prisma.service';  // Import PrismaService
import { readFileSync } from 'fs';  // Import fs module for file reading
import * as path from 'path'; // For path resolution

@Module({
  imports: [ConfigModule],  // If you're using environment variables
  providers: [AuthService, PrismaService],
  controllers: [AuthController],
})
export class AuthModule implements OnModuleInit {
  // Called when the module is initialized
  async onModuleInit() {
    const serviceAccountPath = process.env.FIREBASE_APPLICATION_CREDENTIALS;
    
    if (!serviceAccountPath) {
      throw new Error('FIREBASE_APPLICATION_CREDENTIALS environment variable is not set');
    }

    // Resolve the path and load the Firebase service account
    try {
      const serviceAccount = JSON.parse(readFileSync(path.resolve(serviceAccountPath), 'utf8'));
      
      // Initialize Firebase Admin SDK
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error.message);
      throw new Error('Failed to initialize Firebase Admin');
    }
  }
}
