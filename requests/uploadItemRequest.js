const sharp = require("sharp")
const ThumbnailGenerator = require('video-thumbnail-generator').default
const {logger} = require("../utils/logger")

const uploadItemRequest = (req, res) => {
    let filedata = req.file
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        logger.http('POST-response', {message: '/uploadItem', data: "Uploading file error"})
        res.send("Uploading file error")
    }
    
    if (filedata.mimetype.startsWith('video')) {
        const tg = new ThumbnailGenerator({
            sourcePath: filedata.path,
            thumbnailPath: 'temp/',
        });
        
        tg.generate({
            percent: 1,
            timestamps: [0],
            size: '1000x?'
        })
            .then((preview) => {
                logger.debug('video-preview SUCCESS', {data: preview, module: 'uploadItemRequest'})
                const photoProps = {
                    preview: 'http://localhost:5000/images/' + preview[0],
                    tempPath: filedata.path,
                }
                logger.http('POST-response', {message: '/uploadItem', data: photoProps})
                res.send(photoProps)
            })
            .catch(err => logger.error('video-preview ERROR', {data: err, module: 'uploadItemRequest'}));
        
    } else {
        sharp(filedata.path)
            .withMetadata()
            .clone()
            .resize(200)
            .jpeg({quality: 80})
            .toFile(filedata.path + '-preview.jpg')
            .then(() => {
                const photoProps = {
                    preview: 'http://localhost:5000/images/' + filedata.filename + '-preview.jpg',
                    tempPath: filedata.path,
                }
                logger.debug('sharp SUCCESS', {data: filedata.originalname, module: 'uploadItemRequest'})
                logger.http('POST-response', {message: '/uploadItem', data: photoProps})
                res.send(photoProps)
            })
            .catch(err => logger.error('sharp ERROR', {data: err, module: 'uploadItemRequest'}));
    }
}

module.exports = {uploadItemRequest}
