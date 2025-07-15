# CI/CD Pipeline Secrets Setup

This project’s GitHub Actions pipeline requires several secrets to be configured in your repository settings. These secrets are used for secure deployment, Docker authentication, and environment configuration.

## Required Secrets

| Secret Name           | Description                                                                                 |
|----------------------|---------------------------------------------------------------------------------------------|
| `DO_HOST`            | The IP address or hostname of your DigitalOcean server (for SSH deployment).                |
| `DO_SSH_KEY`         | The private SSH key (in PEM format) for root access to your DigitalOcean server.            |
| `DOCKERHUB_USERNAME` | Your Docker Hub username (for pushing images).                                              |
| `DOCKERHUB_TOKEN`    | A Docker Hub access token or password (for authenticating Docker pushes).                   |
| `DOT_ENV_FILE`       | The contents of your `.env` file, containing environment variables for the application.      |

## How to Set Up Secrets

1. **Go to your GitHub repository.**
2. Click on **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret** for each secret listed above.
4. Enter the secret name (e.g., `DO_HOST`) and its value.
   - For `DO_SSH_KEY`, paste the entire private key (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`).
   - For `DOT_ENV_FILE`, paste the full contents of your `.env` file. This will be used to generate `.env.ci` during the pipeline run.
5. Save each secret.

## Notes

- **Never commit your secrets or `.env` files to the repository.** Always use GitHub Secrets for sensitive data.
- The pipeline expects these secrets to be present for successful deployment and testing.
- If you add new environment variables to your `.env` file, update the `DOT_ENV_FILE` secret accordingly.
