FROM node:22-alpine

WORKDIR /app

# Install nodemon globally for development hot reload
RUN npm install -g nodemon

COPY package*.json ./

RUN npm install

COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 5050

CMD ["node", "src/index.js"]
