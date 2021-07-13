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
 * @param {string} fileName
 * @param {string} src - original filePath
 * @param {string} dest - new filePath
 * @returns {Promise} true or Error
 */
const asyncMoveFile = async ( fileName, src, dest) => {
	return await new Promise(((resolve, reject) => {
		const srcWithName = src + '/' + fileName
		const destWithName = dest + '/' + fileName
		return fs.move(srcWithName, destWithName, err => {
			if (err) {
				const errorMessage = `fs.move ${err} - ${destWithName}`
				console.log(errorMessage)
				reject(new Error(errorMessage))
			} else {
				console.log('fs.move SUCCESS: ' + destWithName)
				resolve(dest)
			}
		})
	}))
}

module.exports = {getConfig, moveFileAndCleanTemp, renameFile, asyncMoveFile, DBFilters}
