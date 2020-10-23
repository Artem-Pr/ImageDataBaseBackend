import fs from "fs-extra";
import createError from "http-errors";

export const keywordsRequest = (request, response, tempFolder) => {
	console.log('tempFolder', tempFolder)
	// очищаем temp
	fs.emptyDirSync(tempFolder);
	
	const configCollection = request.app.locals.configCollection;
	configCollection.findOne({name: "keywords"}, function (err, res) {
		if (err) {
			console.log('configCollection.findOne (keywords) - oops!', err)
			throw createError(400, `configCollection find keywords error`)
		}
		if (res) {
			response.send(res.keywordsArr)
		} else {
			response.send([])
		}
	})
}
