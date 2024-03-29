const fs = require('fs-extra')
const ObjectId = require('mongodb').ObjectID
const {logger} = require("./logger")
const moment = require('moment')
const {
    PORT,
    VIDEO_EXTENSION_LIST,
    TEMP_FOLDER,
} = require('../constants')
const {dateTimeFormat, dateFormat} = require('./dateFormat');

const deepCopy = obj => JSON.parse(JSON.stringify(obj))
const createPid = length => Number(Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0'))
const removeExtraSlash = (value) => (value.endsWith('/') ? value.slice(0, -1) : value)
const removeExtraFirstSlash = (value) => (value.startsWith('/') ? value.slice(1) : value)
const getFilePathWithoutName = (fullPath) => (fullPath.split('/').slice(0, -1).join('/'))
const createFolderIfNotExist = (dir) => {
    if (!fs.pathExistsSync(dir)){
        fs.mkdirsSync(dir, {recursive: true})
        logger.debug('createFolderIfNotExist - SUCCESS', {message: dir})
    }
}

const stringToDate = (stringDate) => moment.utc(stringDate, dateTimeFormat).toDate()
/**
 *
 * @param date
 * @param isDateFormat
 * @return {string}
 */
const dateToString = (date, isDateFormat) => moment(new Date(date))
    .format(isDateFormat ? dateFormat : dateTimeFormat)

const transformDBObjectDateToString = ({originalDate, ...rest}) => ({
    ...rest,
    originalDate: dateToString(originalDate)
})

const transformDBResponseDateToString = (DBObjectRes) => {
    if (Array.isArray(DBObjectRes)) {
        return DBObjectRes.map(item => transformDBObjectDateToString(item))
    }
    return transformDBObjectDateToString(DBObjectRes)
}

/**
 * Create uniq paths: recursively get all folders and subfolders from fullPaths list
 *
 * @param {string[]} paths array of fullPaths without file name
 * @return {string[]}
 */
const getUniqPaths = (paths) => {
    /**
     * @param {string} fullPath
     * @return {string[]}
     */
    const getArrayOfSubfolders = (fullPath) => {
        const fullPathParts = fullPath.split('/')
        const fullPathWithoutLastFolder = fullPathParts.slice(0, -1).join('/')
        return fullPathParts.length === 1
            ? fullPathParts
            : [...getArrayOfSubfolders(fullPathWithoutLastFolder), fullPath]
    }
    
    const pathsWithSubfolders = paths
        .reduce((accum, currentPath) => ([...accum, ...getArrayOfSubfolders(currentPath)]), [])
        .filter(Boolean)
    return Array.from(new Set(pathsWithSubfolders)).sort()
}

/**
 * @param {number} codeLength
 * @return {string}
 */
const getRandomCode = (codeLength) => {
    return Math.floor(Math.random() * Math.pow(10, codeLength)).toString().padStart(codeLength, "0")
}


// Todo: move to DBController
const DBFilters = {
    getFilterByIds: idsArr => ({
        _id: {
            $in: idsArr.map(id => ObjectId(id))
        }
    })
}

/**
 * create an Error for sending
 *
 * @param {string} message
 * @param {string} moduleName
 */
const getError = (message, moduleName) => {
    logger.error('ERROR:', {message, data: moduleName})
    return {error: message}
}

/**
 * Create, log and send Error message
 *
 * @param {{
 *     status: any,
 * } | undefined} res - response object. Minimal: {send: null}
 * @param {'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'} queryType
 * @param {string} queryUrl
 * @param {string} errorMessage
 * @param {string} moduleName
 */
const getAndSendError = (res, queryType, queryUrl, errorMessage, moduleName) => {
    const error = getError(errorMessage, moduleName)
    logger.http(`${queryType}-response`, {message: queryUrl, data: error})
    res ? res.status(500).send(error) : throwError(errorMessage, true)
}

/**
 * create an Error for throwing
 *
 * @param {string} errorMessage - error message
 * @param {boolean} useThrow - use Throw syntax
 * @return {Error}
 */
const throwError = (errorMessage, useThrow) => {
    logger.error('throw: ', {message: errorMessage})
    if (useThrow) throw new Error(errorMessage)
    return new Error(errorMessage)
}

const moveFileAndCleanTemp = async (tempPath, targetPath) => {
    await fs.moveSync(tempPath, targetPath)
    await fs.remove(tempPath + '-preview.jpg')
}

/**
 * Get file name from file path
 *
 * @param {string} filePath
 * @return {string} fileName
 */
const pickFileName = (filePath) => {
    return filePath.split('/').slice(-1)[0]
}

/**
 * Get file extension if exist, or ''
 *
 * @param {string} filePath - 'folder/subfolder/fileName.ext'
 * @return {string}
 */
const pickExtension = (filePath) => {
    const filePathArr = filePath.split('.')
    const hasExtension = filePathArr.length > 1
    
    return hasExtension
        ? filePathArr.at(-1)
        : ''
}

/**
 * Get file name without extension
 *
 * @param {string} filePath - 'folder/subfolder/fileName.ext'
 * @return {string} fileName
 */
const removeFileExt = (filePath) => {
    const filePathArr = filePath.split('.')
    const hasExtension = filePathArr.length > 1
    
    return hasExtension
        ? filePathArr.slice(0, -1).join('.')
        : filePath
}

/**
 * @param {object} filedata - Blob, DB or uploading object
 * @param {'filedata'?} filedata.fieldname=filedata
 * @param {string?} filedata.name=IMG_6649.heic
 */
const isBLOB = (filedata) => {
    return Boolean(filedata.fieldname)
}

/**
 * @param {object} filedata - Blob, DB or uploading object
 * @param {'filedata'?} filedata.fieldname=filedata
 * @param {string?} filedata.name=IMG_6649.heic
 */
const isUploadingObject = (filedata) => {
    return Boolean(filedata.name)
}

/**
 * @param {object} filedata - Blob, DB or uploading object
 * @param {'filedata'?} filedata.fieldname=filedata
 * @param {string?} filedata.name=IMG_6649.heic
 * @param {string?} filedata.originalName=IMG_6649.heic
 */
const isDBObject = (filedata) => {
    return Boolean(filedata.originalName)
}

/**
 * @param {string} fileName
 */
const isVideoFile = (fileName) => {
    const ext = fileName.split('.').slice(-1)[0]
    return VIDEO_EXTENSION_LIST.includes(ext)
}

/**
 * @param {string} fileName
 */
const isVideoThumbnail = (fileName) => {
    return fileName.includes('thumbnail') && fileName.endsWith('.png')
}

/**
 * @param {{mimetype: string}} DBObject - file object from DB
 */
const isVideoDBFile = (DBObject) => {
    return DBObject.mimetype.startsWith('video')
}

/**
 * @param {{mimetype: string}} fileData - image Blob or DB object
 */
const isHEICFile = (fileData) => {
    return fileData.mimetype === 'image/heic'
}

/**
 *
 * @param {string} originalName - full path
 * @param {string} newName - full path
 * @return {Promise<string | Error>}
 */
const renameFile = async (originalName, newName) => {
    return await new Promise((resolve, reject) => {
        const isNewFileExists = fs.existsSync(newName)
        if (isNewFileExists) {
            logger.error('fs.rename ERROR: this file already exists -', {message: newName})
            return reject(new Error('fs.rename ERROR: this file already exists - ' + newName))
        }
        return fs.rename(originalName, newName, function (err) {
            if (err) {
                logger.error('fs.rename:', {message: newName})
                reject(new Error('fs.rename ERROR: ' + newName))
            } else {
                logger.info('fs.rename SUCCESS:', {message: newName})
                resolve(newName)
            }
        })
    })
}

/**
 * move file to new directory if there is no same file
 *
 * @param {string} src - original filePath
 * @param {string} dest - new filePath
 * @param {boolean} isOverwrite
 * @returns {Promise<string | Error>} true or Error
 */
const asyncMoveFile = async (src, dest, isOverwrite = false) => {
    const options = {overwrite: !!isOverwrite}
    return await new Promise(((resolve, reject) => {
        return fs.move(src, dest, options, err => {
            if (err) {
                const errorMessage = `fs.move ${err} - ${dest}`
                logger.error(errorMessage)
                reject(new Error(errorMessage))
            } else {
                logger.info('fs.move SUCCESS:', {message: dest})
                resolve(dest)
            }
        })
    }))
}

/**
 * @param {string} src - original full filePath
 * @param {string} dest - new full filePath
 * @return {Promise<string>} dest
 */
const asyncCopyFile = async (src, dest) => {
    const config = {
        overwrite: false,
        errorOnExist: true
    }
    return await new Promise(((resolve, reject) => {
        return fs.copy(src, dest, config, err => {
            if (err) {
                const errorMessage = `fs.copy ${err}`
                logger.error(errorMessage)
                reject(new Error(errorMessage))
            } else {
                logger.info('fs.copy SUCCESS:', {message: dest})
                resolve(dest)
            }
        })
    }))
}

/**
 * Remove file or directory recursively
 *
 * @param {string} path
 * @return {Promise<void>}
 */
const asyncRemove = async (path) => {
    try {
        await fs.remove(path)
        logger.info('fs.remove SUCCESS:', {massage: path})
    } catch (error) {
        throwError(error.message, true)
    }
}

/**
 * Check folder existing
 *
 * @param {string} path
 * @return {Promise<boolean>}
 */
const asyncCheckFolder = async (path) => {
    try {
        return await fs.pathExists(path)
    } catch (error) {
        throwError(error.message, true)
    }
}

/**
 * Update name path using new file name
 *
 * @param {Object} DBObject - file object from DB
 * @param {Object} updatedFileDataItem - object for update ({id: number, updatedFields: {}})
 * @return {string} new filePath
 */
const updateNamePath = (DBObject, updatedFileDataItem) => {
    const newDBObject = Object.assign(DBObject)
    const {updatedFields} = updatedFileDataItem
    const isOriginalName = updatedFields && updatedFields.originalName
    if (!isOriginalName) return newDBObject.filePath
    return newDBObject.filePath.replace(
        newDBObject.originalName,
        updatedFields.originalName
    )
}

/**
 * Replace substring exclude file extension
 *
 * @param {string} nameWithExt - new file name with extension
 * @param {string} oldNameWithExt - old file name with extension
 * @param {string} stringForReplacement
 * @return {string} replacement string
 */
const replaceWithoutExt = (nameWithExt, oldNameWithExt, stringForReplacement) => {
    const getNameWithoutExt = name => name.split('.').slice(0, -1).join('.')
    return stringForReplacement.replace(getNameWithoutExt(oldNameWithExt), getNameWithoutExt(nameWithExt))
}

/**
 * @param {Array<string>} pathArr - paths for backup
 * @return {Promise<Object[]>} [{backupPath: string, originalPath: string}]
 */
const backupFiles = async (pathArr) => {
    const getBackupPath = () => TEMP_FOLDER + '/backup' + getRandomCode(6)
    try {
        const promiseArr = pathArr.map(async (originalPath) => {
            const dest = getBackupPath()
            const backupPath = await asyncCopyFile(originalPath, dest)
            return {backupPath, originalPath}
        })
        const backupArr = await Promise.all(promiseArr)
        logger.info('BACKUP_FILES: Success!')
        return backupArr
    } catch (error) {
        throw new Error('BACKUP_FILES: ' + error.message)
    }
}

/**
 * @param {Array<Object>} tempPathObjArr - [{backupPath: string, originalPath: string}]
 * @return {Promise<any>}
 */
const cleanBackup = async (tempPathObjArr) => {
    try {
        const promiseArr = tempPathObjArr.map(async ({backupPath}) => {
            return await fs.remove(backupPath)
        })
        await Promise.all(promiseArr)
        logger.info('CLEAN_BACKUP: Success!')
        return true
    } catch (error) {
        throw new Error(`CLEAN_BACKUP: ${error}`)
    }
}

/**
 * @param {Array<string>} removingFilePathsArr
 * @return {Promise<boolean>}
 */
const removeFilesArr = async (removingFilePathsArr) => {
    try {
        const promiseArr = removingFilePathsArr.map(async filePath => {
            return await fs.remove(filePath)
        })
        await Promise.all(promiseArr)
        logger.debug('Removing filePaths arr:', {data: removingFilePathsArr})
        logger.info('removeFilesArr: Success!')
        return true
    } catch (error) {
        throw new Error(`removeFilesArr: ${error}`)
    }
}

/**
 * Recover files, remove files with updated names if needed
 *
 * @param {Array<Object>} tempPathObjArr - [{backupPath: string, originalPath: string}]
 * @param {Array<string>} removingFilesArr - paths to old files with updated names
 * @return {Promise<any[]>}
 */
const filesRecovery = async (tempPathObjArr, removingFilesArr) => {
    logger.debug('FILES_RECOVERY - removingFilesArr:', {message: removingFilesArr})
    try {
        const promiseArr = tempPathObjArr.map(async ({backupPath, originalPath}) => {
            return await asyncMoveFile(backupPath, originalPath, true)
        })
        await Promise.all(promiseArr)
        await removeFilesArr(removingFilesArr)
        logger.info('FILES_RECOVERY: Success!')
        return true
    } catch (error) {
        throw new Error('RECOVERY_ERROR: ' + error.message)
    }
}

/**
 * Return pathsArr that are subdirectories
 *
 * @param {string} directory
 * @param {string[]} pathsArr
 *
 * @return {subDirectories: string[], numberOfSubdirectories: number}
 */
const getSubdirectories = (directory, pathsArr) => {
    const trimmedDirectory = removeExtraFirstSlash(directory)
    const subDirectories = pathsArr
        .map(path => removeExtraFirstSlash(path))
        .filter(path => path.startsWith(`${trimmedDirectory}/`) && path !== trimmedDirectory)
    return {
        subDirectories,
        numberOfSubdirectories: subDirectories.length
    }
}

/**
 * get param value from request
 *
 * @param {object} req - request object
 * @param {string} req.url=http://localhost:5000/upload?path=folder/subfolder - (example).
 * @param {string} paramName - "path" (example).
 * @return {string|null|Array<string>}
 */
const getParam = (req, paramName) => {
    if (!req.url) {
        throwError('There is no req.url', true)
        return null
    }
    const url = new URL('http://localhost:' + PORT + req.url)
    const param = url.searchParams.get(paramName)
    const paramArr = url.searchParams.getAll(paramName + '[]')
    if (!param && !paramArr) {
        throwError('Request does not contain a required parameter', true)
        return null
    }
    return param || paramArr
}

/**
 * Normalize string with "NFC"
 *
 * @param {string} string
 * @return {string} normalized string
 */
const normalize = (string) => {
    return string.normalize()
}

/**
 * @param {string} nameWithExtension
 * @param {string} newExtension
 * @return {string}
 */
const changeExtension = (nameWithExtension, newExtension) =>
    nameWithExtension.split('.').slice(0, -1).join('.') + '.' + newExtension

module.exports = {
    deepCopy,
    createPid,
    removeExtraSlash,
    removeExtraFirstSlash,
    getFilePathWithoutName,
    createFolderIfNotExist,
    getUniqPaths,
    getError,
    getAndSendError,
    throwError,
    moveFileAndCleanTemp,
    pickFileName,
    pickExtension,
    removeFileExt,
    isBLOB,
    isUploadingObject,
    isDBObject,
    isVideoFile,
    isVideoThumbnail,
    isVideoDBFile,
    isHEICFile,
    renameFile,
    asyncMoveFile,
    asyncCopyFile,
    asyncRemove,
    asyncCheckFolder,
    updateNamePath,
    replaceWithoutExt,
    backupFiles,
    cleanBackup,
    filesRecovery,
    removeFilesArr,
    getSubdirectories,
    getParam,
    normalize,
    transformDBResponseDateToString,
    stringToDate,
    dateToString,
    changeExtension,
    DBFilters
}
