FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=8079
EXPOSE 8079
USER node
CMD ["node", "server.js"]
