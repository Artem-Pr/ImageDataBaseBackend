const fs = require('fs-extra')
const {getError, removeFilesArr} = require("../utils/common")
const ObjectId = require('mongodb').ObjectID

const returnValuesIfError = (error) => {
    const has = message => error.message.includes(message)
    return (
        has('removeFilesArr:')
    )
}

/**
 * Push new exif to files, rename files if needed, update filePath and DB info
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 * @param {string} dbFolder
 */
const removeFilesItem = async (req, res, dbFolder = '') => {
    const isExistingError = (value, errorMessage) => {
        if (value) return false
        res.send(getError(errorMessage))
        return true
    }
    const isVideo = result => result.mimetype.startsWith('video')
    const isFileIdUndefined = fileId => isExistingError(fileId, 'Remove files item - missing id')
    const isFileExistInCollection = result => !isExistingError(result, 'Remove files item - file not found in DB')
    const isFileExistInDirectory = result => {
        const isFileExist = !isExistingError(fs.existsSync(dbFolder + result.filePath), 'Remove files item - file not found in Directory')
        const isThumbnailExist = isVideo(result)
            ? !isExistingError(fs.existsSync(dbFolder + result.preview), 'Remove files item - thumbnail not found in Directory')
            : true
        return isFileExist && isThumbnailExist
    }
    const isFileNotExist = result => !(isFileExistInCollection(result) && isFileExistInDirectory(result))
    const prepareRemovingPaths = ({filePath, preview, mimetype}) => {
        const getFullPath = shortPath => `${dbFolder}${shortPath}`
        return isVideo({mimetype}) ? [getFullPath(filePath), getFullPath(preview)] : [getFullPath(filePath)]
    }
    
    const fileId = req && req.params && req.params.id
    if (isFileIdUndefined(fileId)) return null
    const filter = {_id: ObjectId(fileId)}
    
    try {
        const collection = req.app.locals.collection
        const result = await collection.findOne(filter)
        
        if (isFileNotExist(result)) return null
        console.log('folder - ', dbFolder + result.filePath)
        
        await removeFilesArr(prepareRemovingPaths(result))
        const removedFilesResponse = await collection.deleteMany(filter)
        const removedFilesNumber = removedFilesResponse.deletedCount
        console.log('Removed Files Number: ', removedFilesNumber)
        res.send({success: 'File deleted successfully'})
    } catch (error) {
        const errorMessage = returnValuesIfError(error)
            ? getError(error.message)
            : getError('OOPS! Something went wrong...' + error)
        res.send(errorMessage)
    }
}

module.exports = {
    removeFilesItem
}
