const {getError, removeFilesArr} = require("../utils/common")
const ObjectId = require('mongodb').ObjectID

const returnValuesIfError = (error) => {
	const has = message => error.message.includes(message)
	return (
		has('removeFilesArr:')
	)
}

const removeFiles = async (req, res, dbFolder = '') => {
	let filedata = req.body
	if (!filedata) {
		res.send(getError("remove files request - File deleting error"))
		return null
	}
	const idsArr = filedata.map(id => ObjectId(id))
	const filter = {_id: {$in: idsArr}}
	
	try {
		const collection = req.app.locals.collection
		const results = collection.find(filter)
		
		if (results.length === 0) {
			res.send(getError('files not found'))
			return null
		}
	
		await removeFilesArr(results.map(({ filePath }) => dbFolder + filePath))
		const removedFilesResponse = await collection.deleteMany(filter)
		const removedFilesNumber = removedFilesResponse.deletedCount
		console.log('Removed Files Number: ', removedFilesNumber)
		res.send(removedFilesNumber)
	} catch (error) {
		const errorMessage = returnValuesIfError(error)
			? getError(error.message)
			: getError('OOPS! Something went wrong...' + error)
		res.send(errorMessage)
	}
}

module.exports = {
	removeFiles
}
