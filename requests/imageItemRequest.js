const {getExifFormPhoto} = require("../utils/exifTool")

// Todo: get url params example
// const url = new URL('http://localhost:5000' + request.url)
// const tempImgPath = url.searchParams.get('tempPath')

const imageItemRequest = async (request, response, exiftoolProcess) => {
	let filedata = request.body
	if (!filedata) response.send("Ошибка при загрузке файла")
	
	const exifListObj = await getExifFormPhoto(filedata, exiftoolProcess)
	
	response.send(JSON.stringify(exifListObj))
}

module.exports = {imageItemRequest}
