const {logger} = require("../utils/logger")
const {getExifFromPhoto} = require("../utils/exifTool")
const {DATABASE_FOLDER, TEMP_FOLDER, UPLOAD_TEMP_FOLDER} = require("../constants")

/**
 * Get prepared path
 *
 * @param {string[]} shortPaths
 */
const addFullPathToArr = (shortPaths) => {
    return shortPaths.map(shortPath => {
        const isTempFolder = (
            shortPath.startsWith(TEMP_FOLDER)
            || shortPath.startsWith(UPLOAD_TEMP_FOLDER)
        )
        return isTempFolder ? shortPath : DATABASE_FOLDER + shortPath
    })
}

const imageItemRequest = async (request, response) => {
    let filedata = request.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        response.send("Getting EXIF error")
    }
    
    const fullPaths = addFullPathToArr(filedata)
    const exifListObj = await getExifFromPhoto(fullPaths, filedata)
    
    logger.http('POST-response', {
        message: '/image-exif',
        data: Object.keys(exifListObj).map(item => ({[item]: {}}))
    })
    response.send(JSON.stringify(exifListObj))
}

module.exports = {imageItemRequest}
