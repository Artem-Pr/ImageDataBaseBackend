const {isVideoThumbnail, pickFileName, isBLOB, isUploadingObject, isDBObject} = require('../common');
const {BasicClass} = require('../basicClass');

class FilePathsManagerUtils {
    /**
     * Preparing filedata for paths manager
     *
     * @param {object} filedata - Blob, DB or uploading object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic - uploading object name
     * @param {string?} filedata.originalname=test-IMG_6538.jpg - Blob object name
     * @param {string?} filedata.originalName=IMG_6649.heic - DB object name
     * @returns {{
     *       targetName: string,
     *       originalName: string,
     *       mimetype: string,
     *       changeDate?: string,
     *       originalDate?: string,
     *       thumbnailName?: string
     *   }}
     */
    static prepareFileData(filedata) {
        if (isBLOB(filedata)) return FilePathsManagerUtils.prepareFiledataFromBlob(filedata);
        if (isUploadingObject(filedata)) return FilePathsManagerUtils.prepareFiledataFromUploadingObject(filedata);
        if (isDBObject(filedata)) return FilePathsManagerUtils.prepareFiledataFromDBObject(filedata);
        else (new BasicClass('FilePathsManagerUtils')).throwError('Cant recognize filedata type');
    }
    
    /**
     * This method is needed for preparing Blob filedata before using
     * filePathsManager constructor
     *
     * @param {object} blobFiledata - image Blob
     * @param {string} blobFiledata.originalname=test-IMG_6585.heic
     * @param {string} blobFiledata.mimetype=image/heic
     * @param {string} blobFiledata.filename=461e38886446803e980440e08f469e58
     * @param {string?} blobFiledata.encoding=7bit
     * @param {string?} blobFiledata.destination=uploadTemp
     * @param {string?} blobFiledata.path=uploadTemp/461e38886446803e980440e08f469e58
     * @param {number?} blobFiledata.size=2699094
     * @param {'filedata'?} blobFiledata.fieldname=filedata
     */
    static prepareFiledataFromBlob(blobFiledata) {
        (new BasicClass('FilePathsManagerUtils'))
            .infoLog('prepareFiledataFromBlob', blobFiledata.originalname)
        const {originalname, mimetype, filename} = blobFiledata
        return {
            originalName: filename,
            targetName: originalname,
            mimetype
        }
    }
    
    /**
     * This method is needed for preparing uploading filedata before using
     * filePathsManager constructor
     *
     * @param {object} uploadingFiledata - uploading Filedata object
     * @param {number} uploadingFiledata.changeDate=1654774720420 (example).
     * @param {string?} uploadingFiledata.description="" (example).
     * @param {string} uploadingFiledata.fullSizeJpgPath=uploadTemp/74923089ced5c27bff56d3aa063a200f-fullSize.jpg (example).
     * @param {string} uploadingFiledata.name=IMG_6649.heic (example).
     * @param {string | '-'} uploadingFiledata.originalDate - 2023.01.16 17:23 (example).
     * @param {string | ''?} uploadingFiledata.originalPath=http://localhost:5000/upload_images/74923089ced5c27bff56d3aa063a200f-fullSize.jpg (example).
     * @param {string} uploadingFiledata.preview=http://localhost:5000/upload_images/74923089ced5c27bff56d3aa063a200f-preview.jpg (fullPath or static path).
     * @param {string} uploadingFiledata.tempPath=uploadTemp/74923089ced5c27bff56d3aa063a200f (example).
     * @param {string} uploadingFiledata.type=image/heic (example).
     */
    static prepareFiledataFromUploadingObject(uploadingFiledata) {
        (new BasicClass('FilePathsManagerUtils'))
            .infoLog('prepareFiledataFromUploadingObject', uploadingFiledata.name)
        const {changeDate, originalDate, name, tempPath, preview, type} = uploadingFiledata
        const isThumbnail = isVideoThumbnail(preview)
        
        return {
            changeDate,
            originalDate,
            targetName: name,
            originalName: pickFileName(tempPath),
            mimetype: type,
            ...(isThumbnail && {thumbnailName: pickFileName(preview)})
        }
    }
    
    /**
     * This method is needed for preparing DB filedata before using
     * filePathsManager constructor
     *
     * @param {object} uploadingFiledata - uploading Filedata object
     * @param {number} uploadingFiledata.changeDate=1654774720420 (example).
     * @param {string} uploadingFiledata.filePath=/main/IMG_6649.heic (example).
     * @param {string?} uploadingFiledata.description="" (example).
     * @param {string} uploadingFiledata.fullSizeJpg=/image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg (example).
     * @param {string} uploadingFiledata.fullSizeJpgPath=http://localhost:5000/previews/image-heic/fullSize/2023.01.16-originalDate/IMG_6649-fullSize.jpg (example).
     * @param {string} uploadingFiledata.imageSize=4032x3024 (example).
     * @param {number} uploadingFiledata.size=2298618 (example).
     * @param {string[]} uploadingFiledata.keywords=[] (example).
     * @param {number} uploadingFiledata.megapixels=12.2 (example).
     * @param {string} uploadingFiledata.originalName=IMG_6649.heic (example).
     * @param {string | '-'} uploadingFiledata.originalDate - 2023.01.16 17:23 (example).
     * @param {string} uploadingFiledata.preview=http://localhost:5000/previews/image-heic/preview/2023.01.16-originalDate/IMG_6649-preview.jpg (fullPath or static path).
     * @param {string} uploadingFiledata.tempPath=/main/IMG_6649.heic (example).
     * @param {string} uploadingFiledata.mimetype=image/heic (example).
     * @param {string} uploadingFiledata._id=645fee10b8a27d0011cee525 (example).
     */
    static prepareFiledataFromDBObject(uploadingFiledata) {
        (new BasicClass('FilePathsManagerUtils'))
            .infoLog('prepareFiledataFromDBObject', uploadingFiledata.originalName)
        const {changeDate, originalDate, originalName, preview, mimetype} = uploadingFiledata
        const isThumbnail = isVideoThumbnail(preview)
        
        return {
            changeDate,
            originalDate,
            targetName: originalName,
            originalName: originalName,
            mimetype,
            ...(isThumbnail && {thumbnailName: pickFileName(preview)})
        }
    }
}

module.exports = {FilePathsManagerUtils}
