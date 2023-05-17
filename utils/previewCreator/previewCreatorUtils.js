const {FilePathsManager} = require('../filePathsManager/filePathsManager');
const {isBLOB, isUploadingObject, isDBObject, removeExtraSlash} = require('../common');
const {BasicClass} = require('../basicClass');

class PreviewCreatorUtils {
    /**
     * Preparing filedata for previewCreator
     *
     * @param {object} filedata - Blob, uploading or database file object
     * @param {'filedata'?} filedata.fieldname=filedata
     * @param {string?} filedata.name=IMG_6649.heic - uploading object name
     * @param {string?} filedata.originalname=test-IMG_6538.jpg - Blob object name
     * @param {string?} filedata.originalName=IMG_6649.heic - DB object name
     * @param {object?} filedata.mimetype=image/heic
     * @param {object?} filedata.type=image/heic
     */
    static prepareFileData(filedata) {
        const logger = new BasicClass('PreviewCreatorUtils')
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
        if (isDBObject(filedata)) {
            return {
                name: filedata.originalName,
                mimetype: filedata.mimetype,
            }
        }
        else logger.throwError('Cant recognize filedata type')
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
     *
     * @param {string?} baseFolder=main/2020
     *
     * @param {string?} hashName=af638985f4b4c4db8e53d2db00a296fe - need if useHashForPreviewName=true
     */
    static getPaths(filedata, root, baseFolder, hashName) {
        const logger = new BasicClass('PreviewCreatorUtils')
        
        const basePath = baseFolder || ''
        const filePathsManager = new FilePathsManager(filedata, root, basePath, hashName)
        const {fullPathsObj, basePaths: paths} = filePathsManager.createAllFullPathsForTheFile()
        const {name} = PreviewCreatorUtils.prepareFileData(filedata)
        const pathsObject = {
            basePaths: {
                sourceFullName: fullPathsObj.originalFile,
                targetPreview: fullPathsObj.targetPreview,
                targetFullSizeJpeg: fullPathsObj.targetFullSizeJpeg,
                sourceBaseFolder: paths.originalFile,
                targetBaseFolder: paths.targetPreview,
            },
            filePathsWithoutRootDir: {
                sourceFullName: `${removeExtraSlash(paths.originalFile)}/${name}`,
                previewFullName: fullPathsObj.targetPreview,
                fullSizeJpgFullName: fullPathsObj.targetFullSizeJpeg,
            }
        }
    
        logger.successLog('getPaths', {data: pathsObject})
    
        return pathsObject
    }
}

module.exports = {PreviewCreatorUtils}
