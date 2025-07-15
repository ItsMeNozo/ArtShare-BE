import { Global, Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { ConfigService } from '@nestjs/config';
import { ServiceAccount as FirebaseAdminServiceAccount } from 'firebase-admin';
import { Auth } from 'firebase-admin/auth';

export const FIREBASE_APP_TOKEN = 'FirebaseApp';

@Global()
@Module({
  providers: [
    {
      provide: FIREBASE_APP_TOKEN,
      useFactory: (configService: ConfigService) => {
        const appName =
          configService.get<string>('FIREBASE_APP_NAME') || '[DEFAULT]';

        const existingApp = admin.apps.find((app) => app?.name === appName);
        if (existingApp) {
          Logger.log(
            `Firebase Admin SDK app '${appName}' already initialized. Reusing instance.`,
            'FirebaseModule',
          );
          return existingApp;
        }

        Logger.log(
          `Initializing Firebase Admin SDK app '${appName}'.`,
          'FirebaseModule',
        );

        const serviceAccountFromFileContent: Record<string, any> = {
          type: configService.get<string>('FIREBASE_TYPE'),
          project_id: configService.get<string>('FIREBASE_PROJECT_ID'),
          private_key_id: configService.get<string>('FIREBASE_PRIVATE_KEY_ID'),
          private_key: configService
            .get<string>('FIREBASE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n'),
          client_email: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          client_id: configService.get<string>('FIREBASE_CLIENT_ID'),
          auth_uri: configService.get<string>('FIREBASE_AUTH_URI'),
          token_uri: configService.get<string>('FIREBASE_TOKEN_URI'),
          auth_provider_x509_cert_url: configService.get<string>(
            'FIREBASE_AUTH_PROVIDER_X509_CERT_URL',
          ),
          client_x509_cert_url: configService.get<string>(
            'FIREBASE_CLIENT_X509_CERT_URL',
          ),
        };

        if (
          !serviceAccountFromFileContent.project_id ||
          !serviceAccountFromFileContent.private_key ||
          !serviceAccountFromFileContent.client_email
        ) {
          const missingFields: string[] = [];
          if (!serviceAccountFromFileContent.project_id)
            missingFields.push('FIREBASE_PROJECT_ID');
          if (!serviceAccountFromFileContent.private_key)
            missingFields.push('FIREBASE_PRIVATE_KEY');
          if (!serviceAccountFromFileContent.client_email)
            missingFields.push('FIREBASE_CLIENT_EMAIL');
          const errorMessage = `Firebase Admin SDK initialization failed for app '${appName}'. Missing required credentials from env: ${missingFields.join(', ')}.`;
          Logger.error(errorMessage, 'FirebaseModule');
          throw new Error(errorMessage);
        }

        try {
          const app = admin.initializeApp(
            {
              credential: admin.credential.cert(
                serviceAccountFromFileContent as FirebaseAdminServiceAccount,
              ),
            },
            appName === '[DEFAULT]' ? undefined : appName,
          );
          Logger.log(
            `Firebase Admin SDK app '${app.name}' initialized successfully.`,
            'FirebaseModule',
          );
          return app;
        } catch (error: any) {
          Logger.error(
            `Error initializing Firebase Admin SDK app '${appName}': ${error.message}`,
            error.stack,
            'FirebaseModule',
          );
          throw error;
        }
      },
      inject: [ConfigService],
    },
    {
      provide: Auth,
      useFactory: (app: admin.app.App) => {
        if (!app || typeof app.auth !== 'function') {
          Logger.error(
            'Invalid Firebase App instance received in Auth factory. Cannot get auth service.',
            'FirebaseModule',
          );
          throw new Error(
            'Invalid Firebase App instance for Auth service. Firebase App initialization likely failed.',
          );
        }
        Logger.log(
          `Providing Firebase Auth service for app: ${app.name}`,
          'FirebaseModule',
        );
        return app.auth();
      },
      inject: [FIREBASE_APP_TOKEN],
    },
  ],
  exports: [Auth, FIREBASE_APP_TOKEN],
})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  constructor(
    @Inject(FIREBASE_APP_TOKEN) private readonly app: admin.app.App,
    private readonly authService: Auth,
  ) {}

  onModuleInit() {
    if (this.app && this.authService) {
      this.logger.log(
        `FirebaseModule successfully initialized and bootstrapped. App Name: ${this.app.name}. Auth service is ready.`,
      );
    } else if (!this.app) {
      this.logger.error(
        'FirebaseModule OnModuleInit: Firebase App instance (FIREBASE_APP_TOKEN) could not be resolved!',
      );
    } else {
      this.logger.error(
        'FirebaseModule OnModuleInit: Firebase Auth service could not be resolved, though the App instance seems available.',
      );
    }
  }
}
