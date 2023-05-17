FROM mwader/static-ffmpeg
FROM node:16-alpine3.16

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache \
        build-base \
        glib-dev \
        jpeg-dev \
        libexif-dev \
        libpng-dev \
        libwebp-dev \
        tiff-dev \
        giflib-dev \
        librsvg-dev \
        orc-dev \
        libheif-dev \
        vips-dev \
        perl-image-exiftool

RUN npm install

COPY --from=mwader/static-ffmpeg:5.0-1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:5.0-1 /ffprobe /usr/local/bin/
COPY . .

EXPOSE 5000

ENTRYPOINT ["npm", "start"]
