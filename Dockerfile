FROM node:20
RUN apt-get install python3 -y
WORKDIR /app
COPY package*.json ./
COPY mailparser/package*.json ./mailparser/
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "start"]
