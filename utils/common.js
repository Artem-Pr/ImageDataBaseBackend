const fs = require('fs-extra')
const createError = require('http-errors')
const ObjectId = require('mongodb').ObjectID

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
 * @returns {Promise} true or Error
 */
const asyncMoveFile = async ( src, dest) => {
	return await new Promise(((resolve, reject) => {
		return fs.move(src, dest, err => {
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
 * copy file
 *
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
				// throw new Error(errorMessage)
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

module.exports = {
	getConfig,
	getError,
	moveFileAndCleanTemp,
	renameFile,
	asyncMoveFile,
	asyncCopyFile,
	updateNamePath,
	DBFilters
}
