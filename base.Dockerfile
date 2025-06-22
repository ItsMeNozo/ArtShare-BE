# base.Dockerfile
# This image will contain our slow-to-install build dependencies
FROM node:22-slim

# Install OS dependencies required for building native modules.
# Use apt-get instead of apk.
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  libvips-dev \
  && rm -rf /var/lib/apt/lists/*

# You could also pre-install global node utilities here if needed
# RUN npm install -g some-tool