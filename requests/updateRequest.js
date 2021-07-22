const fs = require('fs-extra')
const createError = require('http-errors')
const {pushExif} = require("../utils/exifTool")
const {
	asyncMoveFile,
	asyncCopyFile,
	renameFile,
	getError,
	updateNamePath,
	backupFiles,
	cleanBackup,
	filesRecovery,
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
		? updatedFields.filePath + '/' + updatedFields.originalName || DBObject.originalName
		: updateNamePath(DBObject, { id, updatedFields })
	const updatedFieldsWithFilePath = { ...updatedFields, filePath }
	const filter = {_id: ObjectId(id)}
	const update = {$set: updatedFieldsWithFilePath}
	const options = {returnOriginal: false}
	
	try {
		const updatedResponse = await collection.findOneAndUpdate(filter, update, options)
		console.log('findOneAndUpdate - update SUCCESS')
		return updatedResponse.value
	} catch (error) {
		console.log("findOneAndUpdate - ERROR", error)
		throw createError(500, `file update error`)
	}
}

const updateDatabase = async (filedata, DBObjectArr, collection) => {
	const dataResponseArr = filedata.map(({id, updatedFields}, i) => {
		return updateFile(id, updatedFields, DBObjectArr[i], collection)
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
		console.log('OOPS! isDifferentNames ERROR: duplicated originalNames - ', DBObject.originalName)
		throw new Error('ERROR - isDifferentNames: duplicated originalName')
	}
	return true
}

/**
 *
 * @param {Object} DBObject
 * @param {Object} updatedFiledataItem
 * @param {string} dbFolder
 * @return {Promise<string | boolean>} new full filePath
 */
const renameFileIfNeeded = async (DBObject, updatedFiledataItem, dbFolder) => {
	const isNeedMoveToNewDest = !!updatedFiledataItem.updatedFields?.filePath // if true - use fs.copy, not fs.rename
	const isNeedUpdateName = !!updatedFiledataItem.updatedFields?.originalName
	
	if (
		!isNeedMoveToNewDest &&
		isNeedUpdateName &&
		isDifferentNames(DBObject, updatedFiledataItem)
	) {
		const newNamePath = updateNamePath(DBObject, updatedFiledataItem)
		await renameFile(dbFolder + DBObject.filePath, dbFolder + newNamePath)
		return newNamePath
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
		has('CLEAN_BACKUP:')
	)
}

/**
 * move file to new directory and change file name if needed
 *
 * @param {string} src - original full file path
 * @param {string} destWithoutName - new file path
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
 * Push new exif to files, rename files if needed, update filePath and DB info
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 * @param {any} exiftoolProcess
 * @param {string} dbFolder
 * @returns {Array} array of DB objects
 */
const updateRequest = async (req, res, exiftoolProcess, dbFolder = '') => {
	let filedata = req.body
	if (!filedata) {
		res.send("update request - File loading error")
		return null
	}
	let filesBackup = []
	let filesNewNameArr = [] // saving full filePaths for filesRecovery
	const idsArr = filedata.map(item => item.id)
	const updateFields = filedata.map(filedataItem => filedataItem.updatedFields)
	const updatedKeywords = updateFields.map(updateFieldsItem => updateFieldsItem.keywords)
	const isUpdatedKeywords = updatedKeywords.length && updatedKeywords.some(item => item.length)
	const isUpdateOriginalDate = updateFields.some(item => item.originalDate)
	
	try {
		const savedOriginalDBObjectsArr = await findObjects(idsArr, req.app.locals.collection)
		const pathsArr = savedOriginalDBObjectsArr.map(DBObject => dbFolder + DBObject.filePath)
		filesBackup = await backupFiles(pathsArr)
		
		if (isUpdatedKeywords || isUpdateOriginalDate) {
			await pushExif(pathsArr, updatedKeywords, updateFields, exiftoolProcess)
		}
		
		const renameFilePromiseArr = savedOriginalDBObjectsArr.map(async (DBObject, i) => {
			const newNamePath = await renameFileIfNeeded(DBObject, filedata[i], dbFolder)
			newNamePath && filesNewNameArr.push(newNamePath)
			return true
		})
		const updateFilePathPromiseArr = savedOriginalDBObjectsArr.map(async (DBObject, i) => {
			const filePath = filedata[i].updatedFields?.filePath
			const newFileName = filedata[i].updatedFields?.originalName
			if (filePath) {
				const newNamePath = await moveFile(DBObject.filePath, filePath, DBObject.originalName, dbFolder, newFileName)
				filesNewNameArr.push(newNamePath)
			}
			return true
		})
		await Promise.all(renameFilePromiseArr)
		await Promise.all(updateFilePathPromiseArr)
		
		const	response = await updateDatabase(filedata, savedOriginalDBObjectsArr, req.app.locals.collection)
		
		cleanBackup(filesBackup)
		
		res.send(response)
		return response
		
	} catch (error) {
		const recoveryResponse = await filesRecovery(filesBackup, filesNewNameArr)
		const recoveryError = recoveryResponse === true ? '' : recoveryResponse
		const errorMessage = returnValuesIfError(error)
			? getError(error.message + recoveryError)
			: getError('OOPS! Something went wrong...' + recoveryError)
		
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
	renameFileIfNeeded
}
