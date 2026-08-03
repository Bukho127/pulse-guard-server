# Use official Node.js runtime as base image
FROM node:22-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
CMD node -e "require('http').get('http://localhost:5001/health',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the application
CMD ["npm", "start"]