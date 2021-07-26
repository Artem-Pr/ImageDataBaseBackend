const fs = require('fs-extra')
const createError = require('http-errors')
const ObjectId = require('mongodb').ObjectID

const deepCopy = obj => JSON.parse(JSON.stringify(obj))

/**
 * @param {number} codeLength
 * @return {string}
 */
const getRandomCode = (codeLength) => {
	return Math.floor(Math.random() * Math.pow(10, codeLength)).toString().padStart(codeLength, "0")
}

const DBFilters = {
	getFilterByIds: idsArr => ({
		_id: {
			$in: idsArr.map(id => ObjectId(id))
		}
	})
}

/**
 * create Error for sending
 *
 * @param {string} message
 */
const getError = (message) => {
	return {error: message}
}

const getConfig = (configPath) => {
	try {
		return fs.readFileSync(configPath, "utf8")
	} catch (err) {
		console.error('Config.json не найден: ', err)
		throw createError(500, `oops..`);
	}
}

const moveFileAndCleanTemp = async (tempPath, targetPath) => {
	await fs.moveSync(tempPath, targetPath)
	await fs.remove(tempPath + '-preview.jpg')
}

/**
 *
 * @param {string} originalName - full path
 * @param {string} newName - full path
 * @return {Promise<string | Error>}
 */
const renameFile = async (originalName, newName) => {
	return await new Promise((resolve, reject) => {
		return fs.rename(originalName, newName, function (err) {
			if (err) {
				console.log('fs.rename ' + err)
				reject(new Error('fs.rename ERROR: ' + newName))
			} else {
				console.log('fs.rename SUCCESS: ' + newName)
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
const asyncMoveFile = async ( src, dest, isOverwrite = false) => {
	const options = { overwrite: !!isOverwrite }
	return await new Promise(((resolve, reject) => {
		return fs.move(src, dest, options, err => {
			if (err) {
				const errorMessage = `fs.move ${err} - ${dest}`
				console.log(errorMessage)
				reject(new Error(errorMessage))
			} else {
				console.log('fs.move SUCCESS: ' + dest)
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
const asyncCopyFile = async ( src, dest) => {
	const config = {
		overwrite: false,
		errorOnExist: true
	}
	return await new Promise(((resolve, reject) => {
		return fs.copy(src, dest, config, err => {
			if (err) {
				const errorMessage = `fs.copy ${err}`
				console.log(errorMessage)
				reject(new Error(errorMessage))
			} else {
				console.log('fs.copy SUCCESS: ' + dest)
				resolve(dest)
			}
		})
	}))
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
	if (!updatedFileDataItem.updatedFields?.originalName) return newDBObject.filePath
	return newDBObject.filePath.replace(
		newDBObject.originalName,
		updatedFileDataItem.updatedFields.originalName
	)
}

/**
 * Update preview path using new file name
 *
 * @param {Object} DBObject - file object from DB
 * @param {Object} updatedFileDataItem - object for update ({id: number, updatedFields: {}})
 * @return {string} new preview path
 */
const updatePreviewPath = (DBObject, updatedFileDataItem) => {
	const getNameWithoutExt = name => name.split('.')[0]
	const updatedName = updatedFileDataItem.updatedFields?.originalName
	const preview = DBObject.preview
	if (updatedName && preview) {
		return preview.replace(getNameWithoutExt(DBObject.originalName), getNameWithoutExt(updatedName))
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
		console.log('BACKUP_FILES: Success!')
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
			const promiseArr = tempPathObjArr.map(async ({ backupPath }) => {
				return await fs.remove(backupPath)
			})
			await Promise.all(promiseArr)
			console.log('CLEAN_BACKUP: Success!:')
			return true
		} catch (error) {
			throw new Error(`CLEAN_BACKUP: ${error}`)
		}
}

/**
 * @param {Array<string>} removingFilesArr
 * @return {Promise<boolean>}
 */
const removeFilesArr = async (removingFilesArr) => {
	try {
		const promiseArr = removingFilesArr.map(async filePath => {
			return await fs.remove(filePath)
		})
		await Promise.all(promiseArr)
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
	console.log('FILES_RECOVERY - removingFilesArr: ', removingFilesArr)
	try {
		const promiseArr = tempPathObjArr.map(async ({ backupPath, originalPath }) => {
			return await asyncMoveFile(backupPath, originalPath, true)
		})
		await Promise.all(promiseArr)
		await removeFilesArr(removingFilesArr)
		console.log('FILES_RECOVERY: Success!')
		return true
	} catch (error) {
		throw new Error('RECOVERY_ERROR: ' + error.message)
	}
}

module.exports = {
	deepCopy,
	getConfig,
	getError,
	moveFileAndCleanTemp,
	renameFile,
	asyncMoveFile,
	asyncCopyFile,
	updateNamePath,
	updatePreviewPath,
	backupFiles,
	cleanBackup,
	filesRecovery,
	removeFilesArr,
	DBFilters
}
