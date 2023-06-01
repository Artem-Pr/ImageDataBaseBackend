const {DATABASE_FOLDER, PREVIEWS_FOLDER} = require('../../../constants');
const {logger} = require('../../../utils/logger');
const {FilePathsStatic} = require('../../../utils/filePathsStatic');
const {createPreview} = require('../helpers/createPreview');
const {updateDBItemFields} = require('../../../utils/updateDBItemFields');
const {dateToString, removeExtraFirstSlash, isHEICFile} = require('../../../utils/common');

const defaultRoot = {
    source: DATABASE_FOLDER,
    preview: PREVIEWS_FOLDER,
}

/**
 *
 * @param {object} res - response object. Minimal: {send: null}
 * @param {object[]} filteredPhotos
 * @param searchPagination
 * @param filesSizeSum
 * @param {boolean} isFullSizePreview
 * @param {boolean} dontSavePreview
 * @param {object} req
 * @param {locals: {collection: {
 *    aggregate: (Array, object) => ({toArray: () => Promise<any>})
 * }}} req.app.locals - express instance
 * @returns {Promise<void>}
 */
const createPreviewAndSendFiles = async (
    res,
    filteredPhotos,
    searchPagination,
    filesSizeSum,
    isFullSizePreview,
    dontSavePreview,
    req
) => {
    logger.debug('filteredPhotos.length: ', {message: filteredPhotos.length})
    const filesWithTempPathPromise = filteredPhotos.map(async item => {
        logger.info('FULL SIZE PREVIEW MODE:', {message: isFullSizePreview ? 'ON' : 'OFF', data: item.originalName})
        
        const filePathsWithoutRootDir = {
            sourceFullName: item.filePath,
            previewFullName: item.preview,
            fullSizeJpgFullName: item.fullSizeJpg,
        }
        
        const filePathStaticInstance = new FilePathsStatic(filePathsWithoutRootDir, defaultRoot)
        
        item.tempPath = item.filePath
        item.originalPath = filePathStaticInstance.getOriginalStaticPath()
        item.fullSizeJpgPath = filePathStaticInstance.getFullSizeJPEGStaticPath()
        item.preview = isFullSizePreview
            ? filePathStaticInstance.getOriginalJPEGStaticPath()
            : filePathStaticInstance.getPreviewStaticPath()
        
        if (!item.preview) {
            const {DBFullPathFullSize, DBFullPath} = await createPreview(res, item, dontSavePreview)
            
            if (!dontSavePreview && DBFullPath) {
                await updateDBItemFields(req, item._id, {
                    preview: `/${removeExtraFirstSlash(DBFullPath)}`,
                    ...(isHEICFile(item) && {fullSizeJpg: `/${removeExtraFirstSlash(DBFullPathFullSize)}`})
                })
            }
        }
        
        return {
            ...item,
            ...(item.originalDate && {originalDate: dateToString(item.originalDate)})
        }
    })
    const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
    const responseObject = {
        files: filesWithTempPath,
        searchPagination,
        filesSizeSum
    }
    logger.http('POST-response', {
        message: '/filtered-photos',
        data: {
            filesLength: responseObject.files.length,
            searchPagination: responseObject.searchPagination,
            filesSizeSum
        }
    })
    res.send(responseObject)
}

module.exports = {createPreviewAndSendFiles}
