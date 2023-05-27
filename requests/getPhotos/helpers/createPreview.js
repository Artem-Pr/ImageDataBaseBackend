const {logger} = require('../../../utils/logger');
const {DATABASE_FOLDER, TEMP_FOLDER, PREVIEWS_FOLDER} = require('../../../constants');
const {PreviewCreator} = require('../../../utils/previewCreator/previewCreator');
const {removeExtraFirstSlash, getFilePathWithoutName, getAndSendError} = require('../../../utils/common');

/**
 *
 * @param {object | undefined} res - response object. Minimal: {send: null}
 *
 * @param {object} filedata - uploading Filedata object
 * @param {number} filedata.changeDate=1654774720420 (example).
 * @param {string} filedata.filePath=/main/IMG_6649.heic (example).
 * @param {string?} filedata.description="" (example).
 * @param {string} filedata.fullSizeJpg=/image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg (example).
 * @param {string} filedata.fullSizeJpgPath=http://localhost:5000/previews/image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg (example).
 * @param {string} filedata.imageSize=4032x3024 (example).
 * @param {number} filedata.size=2298618 (example).
 * @param {string[]} filedata.keywords=[] (example).
 * @param {number} filedata.megapixels=12.2 (example).
 * @param {string} filedata.originalName=IMG_6649.heic (example).
 * @param {string | '-'} filedata.originalDate - 2023.01.16 17:23 (example).
 * @param {string} filedata.preview=http://localhost:5000/previews/image-heic/preview/2023.01.16-originalDate/IMG_6649-preview.jpg (fullPath or static path).
 * @param {string} filedata.tempPath=/main/IMG_6649.heic (example).
 * @param {string} filedata.mimetype=image/heic (example).
 * @param {string} filedata._id=645fee10b8a27d0011cee525 (example).
 *
 * @param {string} filedata.originalPath=http://localhost:5000/dataBase/main/1/VID_20190623_091549.mp4 - additional static path (not from DB)
 *
 * @param {boolean} dontSavePreview=false
 *
 * @returns {Promise<{DBFullPath: string, DBFullPathFullSize: string}>} previewFullPath - /image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg
 */
const createPreview = async (res, filedata, dontSavePreview) => {
    logger.info('Need Sharping', {data: filedata.originalPath})
    const previewCreatorRoot = {
        original: DATABASE_FOLDER,
        targetPreview: dontSavePreview ? TEMP_FOLDER : PREVIEWS_FOLDER
    }
    
    const previewCreator = new PreviewCreator({
        filedata,
        root: previewCreatorRoot,
        baseFolder: removeExtraFirstSlash(getFilePathWithoutName(filedata.filePath)),
        hashName: filedata._id.toString()
    })
    return await previewCreator
        .startProcess()
        .then(({result}) => {
            filedata.preview = result.preview
            filedata.fullSizeJpgPath = result.fullSizeJpg
            filedata.fullSizeJpg = result.fullSizeJpgPath
            
            return {
                DBFullPath: result.DBFullPath,
                DBFullPathFullSize: result.DBFullPathFullSize
            }
        })
        .catch(err => getAndSendError(
            res,
            "POST",
            '/filtered-photos',
            err.message,
            'createPreviewAndSendFiles'
        ))
}

module.exports = {createPreview}
