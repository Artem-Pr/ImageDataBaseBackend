const {FilePathsManager} = require('../filePathsManager/filePathsManager');
const {isBLOB, isUploadingObject} = require('../common');
const {BasicClass} = require('../basicClass');

class PreviewCreatorUtils {
    /**
     * Preparing filedata for previewCreator
     *
     * @param {object} filedata - Blob or database file object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic
     * @param {object?} filedata.originalname=test-IMG_6538.jpg
     * @param {object?} filedata.mimetype=image/heic
     * @param {object?} filedata.type=image/heic
     */
    static prepareFileData(filedata) {
        if (isBLOB(filedata)) {
            return {
                name: filedata.originalname,
                mimetype: filedata.mimetype,
            }
        }
        if (isUploadingObject(filedata)) {
            return {
                name: filedata.name,
                mimetype: filedata.type,
            }
        }
        else (new BasicClass('PreviewCreatorUtils')).throwError('Cant recognize filedata type')
    }
    
    /**
     * @param {object} filedata - Blob or database file object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic (example)
     * @param {object?} filedata.originalname=test-IMG_6538.jpg
     * @param {object?} filedata.mimetype=image/heic
     * @param {object?} filedata.type=image/heic
     *
     * @param {object} root - root directories for original and target files
     * @param {string?} root.original=uploadTemp - DATABASE_FOLDER_NAME | TEMP_FOLDER
     * @param {string?} root.originalPreview=uploadTemp - DATABASE_FOLDER_NAME | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     * @param {string?} root.target=/app/dataBase - DATABASE_FOLDER
     * @param {string?} root.targetPreview=/app/previews - PREVIEWS_FOLDER | UPLOAD_TEMP_FOLDER | TEMP_FOLDER
     */
    static getPaths(filedata, root) {
        const basePath = ''
        const filePathsManager = new FilePathsManager(filedata, root, basePath)
        const {fullPathsObj, basePaths: paths} = filePathsManager.createAllFullPathsForTheFile()
        const {name} = PreviewCreatorUtils.prepareFileData(filedata)
    
        return {
            basePaths: {
                sourceFullName: fullPathsObj.originalFile,
                targetPreview: fullPathsObj.targetPreview,
                targetFullSizeJpeg: fullPathsObj.targetFullSizeJpeg,
                sourceBaseFolder: paths.originalFile,
                targetBaseFolder: paths.targetPreview,
            },
            filePathsWithoutRootDir: {
                sourceFullName: `${paths.originalFile}/${name}`,
                previewFullName: fullPathsObj.targetPreview,
                fullSizeJpgFullName: fullPathsObj.targetFullSizeJpeg,
            }
        }
    }
}

module.exports = {PreviewCreatorUtils}
