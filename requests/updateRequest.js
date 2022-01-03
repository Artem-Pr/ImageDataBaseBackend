const fs = require('fs-extra')
const createError = require('http-errors')
const {logger} = require("../utils/logger")
const {getKeywordsFromUpdateFields, addKeywordsToBase} = require("../utils/addKeywordsToBase")
const {addPathToBase} = require("../utils/addPathToBase")
const {pushExif} = require("../utils/exifTool")
const {
    removeExtraSlash,
    removeExtraFirstSlash,
    asyncMoveFile,
    asyncCopyFile,
    pickFileName,
    renameFile,
    getError,
    updateNamePath,
    replaceWithoutExt,
    updatePreviewPath,
    backupFiles,
    cleanBackup,
    filesRecovery,
    transformDBResponseDateToString,
    stringToDate,
    DBFilters,
} = require("../utils/common")
const ObjectId = require('mongodb').ObjectID

/**
 * Update DB file object (originalName, filePath, originalDate, keywords)
 *
 * @param id
 * @param updatedFields
 * @param DBObject
 * @param collection
 * @return {Promise<*>}
 */
const updateFile = async (id, updatedFields, DBObject, collection) => {
    const filePath = updatedFields.filePath
        ? updatedFields.filePath + '/' + (updatedFields.originalName || DBObject.originalName)
        : updateNamePath(DBObject, {id, updatedFields})
    const preview = updatePreviewPath(DBObject, {id, updatedFields})
    const updatedFieldsWithFilePath = {
        ...updatedFields,
        ...(updatedFields.originalDate && {originalDate: stringToDate(updatedFields.originalDate)}),
        filePath,
        preview
    }
    console.log('updatedFields.originalDate', updatedFieldsWithFilePath)
    const filter = {_id: ObjectId(id)}
    const update = {$set: updatedFieldsWithFilePath}
    // [MONGODB DRIVER] DeprecationWarning: collection.findOneAndUpdate option [returnOriginal] is deprecated and will be removed in a later version.
    // (Use `node --trace-deprecation ...` to show where the warning was created)
    // const options = {new: true} // doesn't work
    const options = {returnOriginal: false}
    
    try {
        const updatedResponse = await collection.findOneAndUpdate(filter, update, options)
        //Todo: добавить в логгер модуль и все родительские модули
        logger.debug('updateFile - findOneAndUpdate: update SUCCESS', {module: 'updateRequest'})
        return transformDBResponseDateToString(updatedResponse.value)
    } catch (error) {
        logger.error('updateFile - findOneAndUpdate: update ERROR', {message: error.message, module: 'updateRequest'})
        throw createError(500, `file update error`)
    }
}

const updateDatabase = async (filedata, DBObjectArr, collection) => {
    const dataResponseArr = filedata.map(({id, updatedFields}) => {
        const currentDBObject = DBObjectArr.find(({_id}) => _id.toString() === id)
        return updateFile(id, updatedFields, currentDBObject, collection)
    })
    return await Promise.all(dataResponseArr)
}

const findObjects = async (idsArr, collection) => {
    const filter = DBFilters.getFilterByIds(idsArr)
    const response = await collection.find(filter).toArray()
    if (!response) throw new Error('OOPS! ERROR - something wrong with collection.find')
    if (!response.length) throw new Error('OOPS! ERROR: "findObjects" can\'t find DB object')
    return response
}

const isDifferentNames = (DBObject, uploadedFileDataItem) => {
    if (uploadedFileDataItem.updatedFields.originalName === DBObject.originalName) {
        logger.error('OOPS! isDifferentNames ERROR: duplicated originalNames -', {
            message: DBObject.originalName,
            module: 'updateRequest'
        })
        throw new Error('ERROR - isDifferentNames: duplicated originalName')
    }
    return true
}

/**
 *
 * @param {Object} DBObject
 * @param {Object} updatedFiledataItem
 * @param {string} dbFolder
 * @param {Array<string>} filesNewNameArr - mutating array for clearing files if something went wrong
 * @return {Promise<Object | boolean>} new full filePath {newNamePath, newPreviewPath}
 */
const renameFileIfNeeded = async (DBObject, updatedFiledataItem, dbFolder = '', filesNewNameArr = []) => {
    const {updatedFields} = updatedFiledataItem
    const isNeedMoveToNewDest = !!(updatedFields && updatedFields.filePath) // if true - use fs.copy, not fs.rename
    const isNeedUpdateName = !!(updatedFields && updatedFields.originalName)
    
    if (
        !isNeedMoveToNewDest &&
        isNeedUpdateName &&
        isDifferentNames(DBObject, updatedFiledataItem)
    ) {
        const newNamePath = updateNamePath(DBObject, updatedFiledataItem)
        filesNewNameArr.push(dbFolder + newNamePath)
        await renameFile(dbFolder + DBObject.filePath, dbFolder + newNamePath)
        
        let newPreviewPath = ''
        if (DBObject.preview) {
            newPreviewPath = replaceWithoutExt(newNamePath, DBObject.filePath, DBObject.preview)
            filesNewNameArr.push(dbFolder + newPreviewPath)
            await renameFile(dbFolder + DBObject.preview, dbFolder + newPreviewPath)
        }
        return {newNamePath, newPreviewPath}
    } else {
        return false
    }
}

/**
 * Get previews full path array
 *
 * @param {Array<Object>} DBObjectArr - DB objects arr
 * @param {string} dbFolder - root directory
 * @return {Array<string>}
 */
const getPreviewArray = (DBObjectArr, dbFolder = '') => {
    return DBObjectArr
        .filter(({preview}) => preview)
        .map(({preview}) => dbFolder + preview)
}

/**
 * Move preview file to new directory, update name if needed, return a new preview path
 *
 * @param {Object} DBObject
 * @param {string} filePathWithoutName
 * @param {string | undefined} newFileName - new file name without path
 * @param {string} dbFolder
 * @return {Promise<string>} - new preview path
 */
const movePreviewFile = async (DBObject, filePathWithoutName, newFileName, dbFolder = '') => {
    try {
        const originalPreviewName = pickFileName(DBObject.preview)
        const newPreviewName = newFileName ? replaceWithoutExt(newFileName, DBObject.originalName, originalPreviewName) : undefined
        return await moveFile(DBObject.preview, filePathWithoutName, originalPreviewName, dbFolder, newPreviewName)
    } catch (error) {
        logger.error('movePreviewFile - ERROR:', {message: error.message, module: 'updateRequest'})
        throw new Error('movePreviewFile: ' + error.message)
    }
}

const returnValuesIfError = (error) => {
    const has = message => error.message.includes(message)
    return (
        has('fs.rename ERROR:') ||
        has('exifTool-') ||
        has('fs.move Error:') ||
        has('fs.copy Error:') ||
        has('BACKUP_FILES:') ||
        has('CLEAN_BACKUP:') ||
        has('movePreviewFile:') ||
        has('addPathToBase ERROR:')
    )
}

/**
 * move file to new directory and change file name if needed
 *
 * @param {string} src - original full file path
 * @param {string} destWithoutName - new file path without name
 * @param {string} originalName
 * @param {string} dbFolder
 * @param {string | undefined} newFileName
 * @return {Promise<string>} updated full file path
 */
const moveFile = async (src, destWithoutName, originalName, dbFolder, newFileName = undefined) => {
    if (newFileName) {
        await asyncCopyFile(dbFolder + src, dbFolder + destWithoutName + '/' + newFileName)
        await fs.remove(dbFolder + src)
        return destWithoutName + '/' + newFileName
    } else {
        await asyncMoveFile(dbFolder + src, dbFolder + destWithoutName + '/' + originalName)
        return destWithoutName + '/' + originalName
    }
}

/**
 * Add filePathWithoutDirectory to "paths" list
 *
 * @param {Object} req
 * @param {Array<Object>} updateFields {
			originalName: string,
			originalDate: string,
			filePath: string
			keywords: string[]
		}[]
 * @return {Promise<string[]>}
 */
const addNewFilePath = async (req, updateFields) => {
    const cleanPath = path => removeExtraFirstSlash(removeExtraSlash(path))
    
    const paths = updateFields
        .map(item => cleanPath(item.filePath || ''))
        .filter(Boolean)
    if (paths.length) {
        return await addPathToBase(req, paths)
    }
    return []
}

/**
 * Create fileData for pushing exif
 *
 * @param {object[]} updateFileDataArr - updatedFields array
 * @param {object[]} originalDBObjects - array of dataBase objects
 * @return {object[]}
 */
const createFiledataForUpdatedExif = (updateFileDataArr, originalDBObjects) => {
    return originalDBObjects.map(({_id, mimetype, filePath}) => {
        const currentUpdatedFields = updateFileDataArr
            .find(({id}) => _id.toString() === id)
            .updatedFields
        return {
            mimetype,
            filePath,
            ...(currentUpdatedFields.originalDate && {originalDate: currentUpdatedFields.originalDate}),
            ...(currentUpdatedFields.keywords && {keywords: currentUpdatedFields.keywords}),
        }
    })
}

/**
 * Push new exif to files, rename files if needed, update filePath and DB info
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 * @param {any} exiftoolProcess
 * @param {string} dbFolder
 * @returns {Object} { files: filesResponse, newFilePath: filePathResponse } filesResponse - array of DB objects
 */
const updateRequest = async (req, res, exiftoolProcess, dbFolder = '') => {
    let filedata = req.body
    if (!filedata) {
        logger.error('Update request: there are no filedata')
        res.send("update request - File loading error")
        return null
    }
    let filesBackup = []
    let filesNewNameArr = [] // saving full filePaths for filesRecovery
    const idsArr = filedata.map(item => item.id)
    const updateFields = filedata.map(filedataItem => filedataItem.updatedFields)
    const updatedKeywords = updateFields.map(updateFieldsItem => updateFieldsItem.keywords)
    const isUpdatedKeywords = updatedKeywords && updatedKeywords.length && updatedKeywords.some(item => item && item.length)
    const isUpdateOriginalDate = updateFields.some(item => item.originalDate)
    
    try {
        const savedOriginalDBObjectsArr = await findObjects(idsArr, req.app.locals.collection)
        const pathsArr = savedOriginalDBObjectsArr.map(DBObject => dbFolder + DBObject.filePath)
        const previewArr = getPreviewArray(savedOriginalDBObjectsArr, dbFolder)
        filesBackup = await backupFiles([...pathsArr, ...previewArr])
        
        if (isUpdatedKeywords || isUpdateOriginalDate) {
            const pushExifData = createFiledataForUpdatedExif(filedata, savedOriginalDBObjectsArr)
            
            await pushExif(
                pushExifData.map(({filePath}) => dbFolder + filePath),
                pushExifData.map(item => item.keywords),
                pushExifData,
                exiftoolProcess
            )
        }
        
        const renameFilePromiseArr = savedOriginalDBObjectsArr.map(async (DBObject) => {
            const currentFileDataItem = filedata.find(({id}) => DBObject._id.toString() === id)
            const newPaths = await renameFileIfNeeded(DBObject, currentFileDataItem, dbFolder, filesNewNameArr)
            newPaths.newNamePath && filesNewNameArr.push(newPaths.newNamePath)
            newPaths.newPreviewPath && filesNewNameArr.push(newPaths.newPreviewPath)
            return true
        })
        const updateFilePathPromiseArr = savedOriginalDBObjectsArr.map(async (DBObject) => {
            const {updatedFields} = filedata.find(({id}) => DBObject._id.toString() === id)
            const filePathWithoutName = updatedFields && updatedFields.filePath
            const newFileName = updatedFields && updatedFields.originalName
            if (filePathWithoutName) {
                const newNamePath = await moveFile(DBObject.filePath, filePathWithoutName, DBObject.originalName, dbFolder, newFileName)
                filesNewNameArr.push(newNamePath)
            }
            if (filePathWithoutName && DBObject.preview) {
                const newPreviewPath = await movePreviewFile(DBObject, filePathWithoutName, newFileName, dbFolder)
                filesNewNameArr.push(newPreviewPath)
            }
            return true
        })
        await Promise.all(renameFilePromiseArr)
        await Promise.all(updateFilePathPromiseArr)
        
        const newKeywordsList = getKeywordsFromUpdateFields(updateFields)
        if (newKeywordsList.length) await addKeywordsToBase(req, newKeywordsList)
        const filePathResponse = await addNewFilePath(req, updateFields)
        const filesResponse = await updateDatabase(filedata, savedOriginalDBObjectsArr, req.app.locals.collection)
        const preparedFilesRes = filesResponse.map(file => ({
            ...file,
            tempPath: `${dbFolder}${file.filePath}`,
            originalPath: `http://localhost:5000/${dbFolder}${file.filePath}`
        }))
        const response = {files: preparedFilesRes, newFilePath: filePathResponse}
        
        cleanBackup(filesBackup)
        
        logger.http('POST-response', {
            message: '/update',
            data: {filesLength: preparedFilesRes.length, newFilePath: filePathResponse}
        })
        res.send(response)
        return response
        
    } catch (error) {
        logger.error('OOPS! need recovery:', {message: error.message, module: 'updateRequest'})
        const recoveryResponse = await filesRecovery(filesBackup, Array.from(new Set(filesNewNameArr)))
        const recoveryError = recoveryResponse === true ? '' : recoveryResponse
        const errorMessage = returnValuesIfError(error)
            ? getError(error.message + recoveryError)
            : getError('OOPS! Something went wrong...' + recoveryError)
        logger.http('POST-response', {message: '/update', data: errorMessage})
        res.send(errorMessage)
    }
}

module.exports = {
    updateRequest,
    updateDatabase,
    updateFile,
    findObjects,
    isDifferentNames,
    moveFile,
    renameFileIfNeeded,
    movePreviewFile,
    getPreviewArray,
    addNewFilePath,
}
