const {logger} = require("../utils/logger")
const {getExifFromPhoto} = require("../utils/exifTool")

/**
 * Get prepared path
 *
 * @param {string[]} shortPaths
 * @param {string} databaseFolder
 */
const addFullPathToArr = (shortPaths, databaseFolder) => {
    return shortPaths.map(shortPath => {
        return shortPath.startsWith('temp') ? shortPath : databaseFolder + shortPath
    })
}

const imageItemRequest = async (request, response, databaseFolder, exiftoolProcess) => {
    let filedata = request.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        response.send("Getting EXIF error")
    }
    
    const fullPaths = addFullPathToArr(filedata, databaseFolder)
    const exifListObj = await getExifFromPhoto(fullPaths, filedata, exiftoolProcess)
    
    logger.http('POST-response', {
        message: '/image-exif',
        data: Object.keys(exifListObj).map(item => ({[item]: {}}))
    })
    response.send(JSON.stringify(exifListObj))
}

module.exports = {imageItemRequest}
