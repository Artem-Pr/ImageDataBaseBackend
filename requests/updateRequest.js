const createError = require('http-errors')
const {DBFilters} = require("../utils/common")
const {pushExif} = require("../utils/exifTool")
const {renameFile} = require("../utils/common")
const ObjectId = require('mongodb').ObjectID

const updateFile = async (id, updatedFields, collection) => {
	const updatedFieldsWithFilePath = {
		...updatedFields,
		...(updatedFields.originalName && {filePath: `tests/test-images/${updatedFields.originalName}`})
	}
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

const updateDatabase = async (filedata, collection) => {
	const dataResponseArr = filedata.map(({id, updatedFields}) => {
		return updateFile(id, updatedFields, collection)
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

const updateNamePath = (DBObject, updatedFileDataItem) => {
	const newDBObject = Object.assign(DBObject)
	return newDBObject.filePath.replace(
		newDBObject.originalName,
		updatedFileDataItem.updatedFields.originalName
	)
}

const renameFileIfNeeded = async (DBObject, updatedFiledataItem) => {
	if (
		updatedFiledataItem.updatedFields?.originalName &&
		isDifferentNames(DBObject, updatedFiledataItem)
	) {
		const newNamePath = updateNamePath(DBObject, updatedFiledataItem)
		return await renameFile(DBObject.filePath, newNamePath)
	}
	return false
}

const returnValuesIfError = (error, res) => {
	if (error.message.includes('fs.rename ERROR:')) {
		res.send(error.message)
		return
	}
	if (error.message.includes('exifTool-')) {
		res.send(error.message)
		return
	}
	res.send('OOPS! Something went wrong...')
}

//Todo: add returning all parameters if something went wrong
/**
 * Push new exif to files, rename files if needed.
 * add functionality to return old version if something went wrong
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 * @param {any} exiftoolProcess
 * @returns {Array} array of DB objects
 */
const updateRequest = async (req, res, exiftoolProcess) => {
	let filedata = req.body
	if (!filedata) {
		res.send("update request - File loading error")
		return null
	}
	const idsArr = filedata.map(item => item.id)
	const updateFields = filedata.map(filedataItem => filedataItem.updatedFields)
	const updatedKeywords = updateFields.map(updateFieldsItem => updateFieldsItem.keywords)
	const isUpdatedKeywords = updatedKeywords.length && updatedKeywords.some(item => item.length)
	const isUpdateOriginalDate = updateFields.some(item => item.originalDate)
	
	try {
		const savedOriginalDBObjectsArr = await findObjects(idsArr, req.app.locals.collection)
		const pathsArr = savedOriginalDBObjectsArr.map(DBObject => DBObject.filePath)
		
		if (isUpdatedKeywords || isUpdateOriginalDate) {
			await pushExif(pathsArr, updatedKeywords, updateFields, exiftoolProcess)
		}
		
		const renameFilePromiseArr = savedOriginalDBObjectsArr.map(async (DBObject, i) => {
			await renameFileIfNeeded(DBObject, filedata[i])
			return true
		})
		const isRenamedArr = await Promise.all(renameFilePromiseArr)
		
		let response
		// if there are no errors with renameFileIfNeeded
		if (!isRenamedArr.some(item => item !== true)) {
			response = await updateDatabase(filedata, req.app.locals.collection)
		} else {
			response = 'Error: renameFileIfNeeded'
		}
		
		res.send(response)
		return response
	} catch (error) {
		returnValuesIfError(error)
	}
}

module.exports = {
	updateRequest,
	updateDatabase,
	updateFile,
	findObjects,
	isDifferentNames,
	updateNamePath,
	renameFileIfNeeded
}
