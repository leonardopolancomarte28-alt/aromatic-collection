FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN mkdir -p /app/data

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
