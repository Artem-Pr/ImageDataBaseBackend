const url = require("url")
const {getExifFormPhoto} = require("../utils/exifTool")

const imageItemRequest = async (request, response, exiftoolProcess) => {
	const queryObject = url.parse(request.url, true).query
	const tempImgPath = queryObject.tempPath
	console.log('tempImgPath', tempImgPath)
	if (!tempImgPath) response.send("Ошибка при получении keywords")
	
	const exifObject = await getExifFormPhoto(tempImgPath, exiftoolProcess)
	response.send(JSON.stringify(exifObject[0]))
}

module.exports = {imageItemRequest}
