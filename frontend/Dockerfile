FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# Start VITE server listening on host interface
CMD ["npm", "run", "dev", "--", "--host"]
