FROM node:20-alpine

RUN mkdir -p /tmp/geoip /app /data
WORKDIR /app

# Copy package files and install dependencies
COPY . .
RUN npm install --production

VOLUME ["/tmp/geoip"]
ENV GEODATADIR=/tmp/geoip

VOLUME ["/data"]
ENV DATA_DIR=/data

# Start the bot
CMD ["sh", "-c", "./update-geoip-db.sh && npm run start"]
