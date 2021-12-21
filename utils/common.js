const fs = require('fs-extra')
const ObjectId = require('mongodb').ObjectID
const {logger} = require("./logger")

const VIDEO_EXTENSION_LIST = ['mkv', 'flv', 'avi', 'mov', 'wmv', 'mp4', 'm4p', 'm4v', 'mpg', 'mp2', 'mpeg', 'm2v', '3gp']

const deepCopy = obj => JSON.parse(JSON.stringify(obj))
const createPid = length => Number(Math.floor(Math.random() * Math.pow(10, length))
            .toString()
            .padStart(length, '0'))
const removeExtraSlash = (value) => (value.endsWith('/') ? value.slice(0, -1) : value)
const removeExtraFirstSlash = (value) => (value.startsWith('/') ? value.slice(1) : value)
const getFilePathWithoutName = (fullPath) => (fullPath.split('/').slice(0, -1).join('/'))

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
 * @param {object} res - response object. Minimal: {send: null}
 * @param {'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'} queryType
 * @param {string} queryUrl
 * @param {string} errorMessage
 * @param {string} moduleName
 */
const getAndSendError = (res, queryType, queryUrl, errorMessage, moduleName) => {
    const error = getError(errorMessage, moduleName)
    logger.http(`${queryType}-response`, {message: queryUrl, data: error})
    res ? res.send(error) : throwError(errorMessage, true)
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
 * Get file name without extension
 *
 * @param {string} filePath
 * @return {string} fileName
 */
const removeFileExt = (filePath) => {
    return filePath.split('.').slice(0, -1).join('.')
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
 * @param {Object} DBObject - file object from DB
 */
const isVideoDBFile = (DBObject) => {
    return DBObject.mimetype.startsWith('video')
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
 * @returns {Promise} true or Error
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
 * use TESTS for updatePreviewPath
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
 * Update preview path using new file name
 *
 * @param {Object} DBObject - file object from DB
 * @param {Object} updatedFileDataItem - object for update ({id: number, updatedFields: {}})
 * @return {string} new preview path
 */
const updatePreviewPath = (DBObject, updatedFileDataItem) => {
    const {updatedFields} = updatedFileDataItem
    const filePathWithoutName = updatedFields && updatedFields.filePath
    const updatedName = updatedFields && updatedFields.originalName
    const preview = filePathWithoutName && DBObject.preview
        ? `${filePathWithoutName}/${pickFileName(DBObject.preview)}`
        : DBObject.preview
    
    if (updatedName && preview) {
        return replaceWithoutExt(updatedName, DBObject.originalName, preview)
    } else {
        return preview
    }
}

/**
 * @param {Array<string>} pathArr - paths for backup
 * @return {Array<Promise<Object>>} [{backupPath: string, originalPath: string}]
 */
const backupFiles = async (pathArr) => {
    const getBackupPath = () => 'temp/backup' + getRandomCode(6)
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
 * @return {Array<Promise<any>>}
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
        .filter(path => path.startsWith(trimmedDirectory) && path !== trimmedDirectory)
    return {
        subDirectories,
        numberOfSubdirectories: subDirectories.length
    }
}

/**
 * get param value from request
 *
 * @param {object} req - request object. Minimal: {url: string}
 * @param {string} paramName
 * @return {string|null}
 */
const getParam = (req, paramName) => {
    if (!req.url) {
        throwError('There is no req.url', true)
        return null
    }
    const url = new URL('http://localhost:5000' + req.url)
    const param = url.searchParams.get(paramName)
    if (!param) {
        throwError('Request does not contain a required parameter', true)
        return null
    }
    return param
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

module.exports = {
    deepCopy,
    createPid,
    removeExtraSlash,
    removeExtraFirstSlash,
    getFilePathWithoutName,
    getUniqPaths,
    getError,
    getAndSendError,
    throwError,
    moveFileAndCleanTemp,
    pickFileName,
    removeFileExt,
    isVideoFile,
    isVideoThumbnail,
    isVideoDBFile,
    renameFile,
    asyncMoveFile,
    asyncCopyFile,
    asyncRemove,
    asyncCheckFolder,
    updateNamePath,
    replaceWithoutExt,
    updatePreviewPath,
    backupFiles,
    cleanBackup,
    filesRecovery,
    removeFilesArr,
    getSubdirectories,
    getParam,
    normalize,
    DBFilters
}
