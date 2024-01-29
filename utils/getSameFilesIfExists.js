const {logger} = require("../utils/logger")
const {DATABASE_FOLDER, PREVIEWS_FOLDER} = require("../constants")
const {DBController} = require("../utils/DBController")
const {FilePathsStatic} = require('../utils/filePathsStatic');

const getStaticPath = ({filePath, preview, fullSizeJpg}) => {
    const defaultRoot = {
        source: DATABASE_FOLDER,
        preview: PREVIEWS_FOLDER,
    }
    const filePathsWithoutRootDir = {
        sourceFullName: filePath,
        previewFullName: preview,
        fullSizeJpgFullName: fullSizeJpg,
    }

    const filePathStaticInstance = new FilePathsStatic(filePathsWithoutRootDir, defaultRoot)

    return {
        originalPath: filePathStaticInstance.getOriginalStaticPath(),
        fullSizeJpgPath: filePathStaticInstance.getFullSizeJPEGStaticPath(),
        preview: filePathStaticInstance.getPreviewStaticPath(),
    }
}

/**
 * @param {{
*   app: {locals: {collection: null | any}},
*   body: null | any
* }} req - request object
* @param {string} name
* @return {Promise<{originalPath: string; fullSizeJpgPath: string; preview: string; filePath: string; originalName: string}[]>} matchedFilesArr
*/
const getSameFilesIfExist = async (req, name) => {
    const collectionController = new DBController(
        req,
        {originalName: name}
    )
    const matchedFilesArr = await collectionController.find('collection')
    logger.error('matchedFilesArr:', {data: matchedFilesArr})

    return matchedFilesArr.map(({filePath, fullSizeJpg, originalName, preview}) => ({
        filePath,
        originalName,
        ...getStaticPath({filePath, fullSizeJpg, preview})
    })) 
}

module.exports = {getSameFilesIfExist}