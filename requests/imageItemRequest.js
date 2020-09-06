import url from "url"
import {getExifFormPhoto} from "../utils/exifTool"

export const imageItemRequest = async (request, response, exiftoolProcess) => {
	const queryObject = url.parse(request.url, true).query
	const tempImgPath = queryObject.tempPath
	console.log('tempImgPath', tempImgPath)
	if (!tempImgPath) response.send("Ошибка при получении keywords")
	
	const exifObject = await getExifFormPhoto(tempImgPath, exiftoolProcess)
	response.send(JSON.stringify(exifObject[0]))
}