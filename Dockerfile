FROM node:20-alpine

WORKDIR /app

# Install deps first for better caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

EXPOSE 5173

# Run Vite dev server and make it reachable from your browser
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]