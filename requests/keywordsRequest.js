const fs = require("fs-extra")
const createError = require("http-errors")

const keywordsRequest = (request, response, tempFolder) => {
	console.log('tempFolder', tempFolder)
	// temp clearing
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

module.exports = {keywordsRequest}
