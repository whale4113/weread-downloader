FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

RUN su node -c "curl -fsSL https://bun.sh/install | bash"

RUN su node -c "curl -fsSL https://deno.land/install.sh | bash"

RUN apt-get update && apt-get install -y chromium