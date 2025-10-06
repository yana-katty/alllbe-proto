FROM node:24-bullseye-slim

# Install zsh and git
RUN apt-get update && apt-get install -y \
    zsh \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set zsh as default shell
SHELL ["/bin/zsh", "-c"]

# Create app directory
WORKDIR /workspace

# Expose port
EXPOSE 3000

# Set the default user to node
USER node

# Command to run the application
CMD ["npm", "run", "dev"]
