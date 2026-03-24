FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# 每次写入数据库后保存到/tmp/data目录
RUN mkdir -p /tmp/data /tmp/uploads/modpacks

EXPOSE 3000

CMD ["npm", "start"]
