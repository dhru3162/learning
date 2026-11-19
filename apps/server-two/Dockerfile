FROM node:22-slim

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests
COPY package.json ./

# Install dependencies using pnpm
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build application
RUN pnpm run build

EXPOSE 4500

CMD ["node", "dist/main.js"]