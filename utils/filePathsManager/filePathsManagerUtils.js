const {isVideoThumbnail, pickFileName, isBLOB, isUploadingObject} = require('../common');
const {BasicClass} = require('../basicClass');
const {useOriginalNameForPreview} = require('../../constants');

class FilePathsManagerUtils {
    /**
     * Preparing filedata for paths manager
     *
     * @param {object} filedata - Blob or database file object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic (example).
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
            targetName: useOriginalNameForPreview ? originalname : filename,
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
}

module.exports = {FilePathsManagerUtils}
