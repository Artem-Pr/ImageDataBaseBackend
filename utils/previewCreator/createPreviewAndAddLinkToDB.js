const {logger} = require('../logger');
const {FilePathsStatic} = require('../filePathsStatic');
const {createPreview} = require('../../requests/getPhotos/helpers/createPreview');
const {updateDBItemFields} = require('../updateDBItemFields');
const {removeExtraFirstSlash, isHEICFile, dateToString} = require('../common');
const {DATABASE_FOLDER, PREVIEWS_FOLDER} = require('../../constants');

const defaultRoot = {
    source: DATABASE_FOLDER,
    preview: PREVIEWS_FOLDER,
}

/**
 *
 * @param {object | undefined} res - response object. Minimal: {send: null}
 * @param filteredPhotos - photos array from DB
 * @param {boolean?} isFullSizePreview
 * @param {boolean} dontSavePreview
 * @param {boolean?} recreatePreviewIfExist
 * @param {object} req
 * @param {locals: {collection: {
 *    aggregate: (Array, object) => ({toArray: () => Promise<any>})
 * }}} req.app.locals - express instance
 * @returns {Promise<void>}
 */
const createPreviewAndAddLinkToDB = async ({
                                               res,
                                               filteredPhotos,
                                               isFullSizePreview,
                                               dontSavePreview,
                                               recreatePreviewIfExist,
                                               req
                                           }
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
            ? filePathStaticInstance.getOriginalStaticPath()
            : filePathStaticInstance.getPreviewStaticPath()
        
        if (!item.preview || recreatePreviewIfExist) {
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
    return await Promise.all(filesWithTempPathPromise)
}

module.exports = {createPreviewAndAddLinkToDB}
