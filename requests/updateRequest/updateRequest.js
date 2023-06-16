const fs = require('fs-extra')
const createError = require('http-errors')
const {logger} = require("../../utils/logger")
const {getKeywordsFromUpdateFields, addKeywordsToBase} = require("../../utils/addKeywordsToBase")
const {addPathToBase} = require("../../utils/addPathToBase")
const {pushExif} = require("../../utils/exifTool")
const {
    removeExtraSlash,
    removeExtraFirstSlash,
    asyncMoveFile,
    asyncCopyFile,
    renameFile,
    getError,
    updateNamePath,
    backupFiles,
    cleanBackup,
    filesRecovery,
    transformDBResponseDateToString,
    stringToDate,
    DBFilters,
    getFilePathWithoutName,
} = require("../../utils/common")
const {DBRequests, DBController} = require('../../utils/DBController');
const {PORT, DATABASE_FOLDER} = require('../../constants')
const {createPreviewAndAddLinkToDB} = require('../../utils/previewCreator/createPreviewAndAddLinkToDB');
const {omit} = require('ramda');
const ObjectId = require('mongodb').ObjectID

/**
 * @param updatedFields
 * @param {string} updatedFields.originalName?
 * @param {string} updatedFields.filePath?
 * @param {string} updatedFields.originalDate?
 * @param {string} updatedFields.keywords?
 * @param {number} updatedFields.rating?
 * @param {string} updatedFields.description?
 * @param {string} updatedFields.timeStamp?
 * @param {boolean} updatedFields.needUpdatePreview?
 */
const normalizeStringFields = (updatedFields) => (
    Object.keys(updatedFields).reduce((accum, current) => {
        if (!updatedFields[current]) return accum
        if (typeof updatedFields[current] === 'string') {
            const normalizedString = updatedFields[current].normalize()
            return {...accum, [current]: normalizedString}
        }
        return {...accum, [current]: updatedFields[current]}
    }, {})
)

/**
 * Update DB file object (originalName, filePath, originalDate, keywords)
 *
 * @param id
 * @param updatedFields
 * @param {string} updatedFields.originalName?
 * @param {string} updatedFields.filePath?
 * @param {string} updatedFields.originalDate?
 * @param {string} updatedFields.keywords?
 * @param {number} updatedFields.rating?
 * @param {string} updatedFields.description?
 * @param {string} updatedFields.timeStamp?
 * @param {boolean} updatedFields.needUpdatePreview?
 * @param DBObject
 * @param collection
 * @return {Promise<*>}
 */
const updateFile = async (id, updatedFields, DBObject, collection) => {
    const filePath = updatedFields.filePath
        ? updatedFields.filePath + '/' + (updatedFields.originalName || DBObject.originalName)
        : updateNamePath(DBObject, {id, updatedFields})
    const updatedFieldsWithFilePath = {
        ...omit(['needUpdatePreview'], updatedFields),
        ...(updatedFields.originalDate && {originalDate: stringToDate(updatedFields.originalDate)}),
        filePath,
    }
    const filter = {_id: ObjectId(id)}
    const update = {$set: updatedFieldsWithFilePath}
    const options = {returnDocument: 'after'}
    
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
 * @param {Array<string>} filesNewNameArr - mutating array for clearing files if something went wrong
 * @return {Promise<Object | boolean>} new full filePath {newNamePath, newPreviewPath}
 */
const renameFileIfNeeded = async (DBObject, updatedFiledataItem, filesNewNameArr = []) => {
    const {updatedFields} = updatedFiledataItem
    const isNeedMoveToNewDest = !!(updatedFields && updatedFields.filePath) // if true - use fs.copy, not fs.rename
    const isNeedUpdateName = !!(updatedFields && updatedFields.originalName)
    
    if (
        !isNeedMoveToNewDest &&
        isNeedUpdateName &&
        isDifferentNames(DBObject, updatedFiledataItem)
    ) {
        const newNamePath = updateNamePath(DBObject, updatedFiledataItem)
        filesNewNameArr.push(DATABASE_FOLDER + newNamePath)
        await renameFile(DATABASE_FOLDER + DBObject.filePath, DATABASE_FOLDER + newNamePath)
        
        return {newNamePath}
    } else {
        return false
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
        has('addPathToBase ERROR:') ||
        has('create preview:')
    )
}

/**
 * move file to new directory and change file name if needed
 *
 * @param {string} src - original full file path
 * @param {string} destWithoutName - new file path without name
 * @param {string} originalName
 * @param {string | undefined} newFileName
 * @return {Promise<string>} updated full file path
 */
const moveFile = async (src, destWithoutName, originalName, newFileName = undefined) => {
    if (newFileName) {
        await asyncCopyFile(DATABASE_FOLDER + src, DATABASE_FOLDER + destWithoutName + '/' + newFileName)
        await fs.remove(DATABASE_FOLDER + src)
        return destWithoutName + '/' + newFileName
    } else {
        await asyncMoveFile(DATABASE_FOLDER + src, DATABASE_FOLDER + destWithoutName + '/' + originalName)
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
            ...(currentUpdatedFields.description && {description: currentUpdatedFields.description}),
            ...(currentUpdatedFields.rating && {rating: currentUpdatedFields.rating}),
        }
    })
}

/**
 * Find current file data item by ID
 *
 * @param {object[]} filedata
 * @param {object} DBObject
 * @return {object}
 */
const getFileDataItem = (filedata, DBObject) => {
    return filedata.find(({id}) => DBObject._id.toString() === id)
}

/**
 * @param {object[]} savedOriginalDBObjectsArr - db objects,that matched with filedata
 * @param {object[]} filedata - updated object array with updatedFields inside
 * @return {string[]} - list of updated fullNames
 */
const getUpdatedFullNamesArr = (savedOriginalDBObjectsArr, filedata) => (
    savedOriginalDBObjectsArr
        .map(DBObject => {
            const currentFileDataItem = getFileDataItem(filedata, DBObject)
            const filePathWithoutName = getFilePathWithoutName(DBObject.filePath)
            
            const {filePath, originalName} = currentFileDataItem.updatedFields
            
            if (!filePath && !originalName) {
                return false
            }
            const resultFilePath = filePath || filePathWithoutName
            const resultFileName = originalName || DBObject.originalName
            return resultFilePath + '/' + resultFileName
        })
        .filter(Boolean)
)

/**
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {string[]} newFullNames - list of updated fullNames (newFullNames has to be not empty)
 * @return {Promise<Object[]>}
 */
const isFullNamesExistInDB = (req, newFullNames) => {
    const checkFileNamesDBRequest = {
        $or: newFullNames.map(newFileName => (
            DBRequests.byFieldPartsOfAndCondition('filePath', newFileName)
        ))
    }
    
    const dbController = new DBController(req, checkFileNamesDBRequest)
    return dbController.find('collection')
}

/**
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object[]} savedOriginalDBObjectsArr - db objects,that matched with filedata
 * @param {object[]} filedata - updated object array with updatedFields inside
 * @return {Promise<Boolean>}
 */
// Todo: add tests
const throwErrorIfNewFullNameExist = async (req, savedOriginalDBObjectsArr, filedata) => {
    const newFullNames = getUpdatedFullNamesArr(savedOriginalDBObjectsArr, filedata)
    
    if (newFullNames.length) {
        const dbResponse = await isFullNamesExistInDB(req, newFullNames)
        if (dbResponse.length) throw new Error(
            'File name: ' + dbResponse.map(({filePath}) => filePath) + '  already exist'
        )
    }
    
    logger.debug('Check existing files - SUCCESS', {module: 'throwErrorIfNewFullNameExist'})
}

/**
 * Push new exif to files, rename files if needed, update filePath and DB info
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 * @returns {Object} { files: filesResponse, newFilePath: filePathResponse } filesResponse - array of DB objects
 */
const updateRequest = async (req, res) => {
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
    const isUpdateExif = updateFields.some(({
                                                originalDate,
                                                rating,
                                                description
                                            }) => originalDate || rating || description)
    
    try {
        const savedOriginalDBObjectsArr = await findObjects(idsArr, req.app.locals.collection)
        const pathsArr = savedOriginalDBObjectsArr.map(DBObject => DATABASE_FOLDER + DBObject.filePath)
        
        await throwErrorIfNewFullNameExist(req, savedOriginalDBObjectsArr, filedata)
        
        filesBackup = await backupFiles(pathsArr)
        
        if (isUpdatedKeywords || isUpdateExif) {
            const pushExifData = createFiledataForUpdatedExif(filedata, savedOriginalDBObjectsArr)
            
            await pushExif(
                pushExifData.map(({filePath}) => DATABASE_FOLDER + filePath),
                pushExifData.map(item => item.keywords),
                pushExifData
            )
        }
        
        const renameFilePromiseArr = savedOriginalDBObjectsArr.map(async (DBObject) => {
            const currentFileDataItem = getFileDataItem(filedata, DBObject)
            const newPaths = await renameFileIfNeeded(DBObject, currentFileDataItem, filesNewNameArr)
            newPaths.newNamePath && filesNewNameArr.push(newPaths.newNamePath)
            
            return true
        })
        const updateFilePathPromiseArr = savedOriginalDBObjectsArr.map(async (DBObject) => {
            const {updatedFields} = getFileDataItem(filedata, DBObject)
            const filePathWithoutName = updatedFields && updatedFields.filePath
            const newFileName = updatedFields && updatedFields.originalName
            if (filePathWithoutName) {
                const newNamePath = await moveFile(DBObject.filePath, filePathWithoutName, DBObject.originalName, newFileName)
                filesNewNameArr.push(newNamePath)
            }
            
            return true
        })
        await Promise.all(renameFilePromiseArr)
        await Promise.all(updateFilePathPromiseArr)
        
        const newKeywordsList = getKeywordsFromUpdateFields(updateFields)
        if (newKeywordsList.length) await addKeywordsToBase(req, newKeywordsList)
        const filePathResponse = await addNewFilePath(req, updateFields)
        const filesResponse = await updateDatabase(filedata, savedOriginalDBObjectsArr, req.app.locals.collection)
        const needToUpdateTimeStamp = Boolean(filesResponse.length === 1 && filesResponse[0].timeStamp)
        const needUpdatePreview = filedata.some(item => item.updatedFields && item.updatedFields.needUpdatePreview)
        
        if (needToUpdateTimeStamp || needUpdatePreview) {
            await createPreviewAndAddLinkToDB({
                res: undefined,
                filteredPhotos: filesResponse,
                isFullSizePreview: false,
                dontSavePreview: false,
                recreatePreviewIfExist: true,
                req
            })
        }
        
        const preparedFilesRes = filesResponse.map(file => ({
            ...file,
            tempPath: `${DATABASE_FOLDER}${file.filePath}`,
            originalPath: `http://localhost:${PORT}/${DATABASE_FOLDER}${file.filePath}`
        }))
        const response = {files: preparedFilesRes, newFilePath: filePathResponse}
        
        void cleanBackup(filesBackup)
        
        logger.http('POST-response', {
            message: '/update',
            data: {filesLength: preparedFilesRes.length, newFilePath: filePathResponse}
        })
        res.send(response)
        return response
        
    } catch (error) {
        if (error.message.includes('File name:')) {
            res.send(getError(error.message))
            return
        }
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
    addNewFilePath,
}
