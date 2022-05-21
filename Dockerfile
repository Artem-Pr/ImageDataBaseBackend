FROM mwader/static-ffmpeg
FROM node:16

WORKDIR /app

COPY package*.json /app

RUN npm install

COPY --from=mwader/static-ffmpeg:5.0-1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:5.0-1 /ffprobe /usr/local/bin/
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
