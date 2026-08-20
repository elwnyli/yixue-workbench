FROM node:22-alpine
WORKDIR /app
COPY package.json core.mjs server.mjs ./
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.mjs"]
