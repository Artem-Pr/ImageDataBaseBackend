const {getExifFromPhoto} = require("../utils/exifTool")

/**
 * Get prepared path
 *
 * @param {string[]} shortPaths
 * @param {string} databaseFolder
 */
const addFullPathToArr = (shortPaths, databaseFolder) => {
	return shortPaths.map(shortPath => {
		return shortPath.startsWith('temp') ? shortPath : databaseFolder + shortPath
	})
}

const imageItemRequest = async (request, response, databaseFolder, exiftoolProcess) => {
	let filedata = request.body
	if (!filedata) response.send("Ошибка при загрузке файла")
	
	const fullPaths = addFullPathToArr(filedata, databaseFolder)
	const exifListObj = await getExifFromPhoto(fullPaths, filedata, exiftoolProcess)
	
	response.send(JSON.stringify(exifListObj))
}

module.exports = {imageItemRequest}
