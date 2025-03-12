FROM node:slim
ENV NODE_ENV production
WORKDIR /github-pretty-readme
COPY . .
RUN npm install
EXPOSE 8080