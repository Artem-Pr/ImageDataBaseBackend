const createError = require("http-errors")

const addPathToBase = async (req, basePathWithoutRootDirectory) => {
	const configCollection = req.app.locals.configCollection;
	await configCollection.findOne({name: "paths"}, async function (err, res) {
		if (err) {
			console.log('configCollection.findOne (path) - oops!', err)
			throw createError(400, `configCollection find path error`)
		}
		if (!res) {
			await configCollection.insertOne({name: "paths", pathsArr: [basePathWithoutRootDirectory]}, function (err) {
				if (err) {
					console.log("Oops!- configCollection insert path error", err)
					throw createError(400, `configCollection insert path error`)
				}
			})
		} else {
			const pathsSet = new Set(res.pathsArr)
			pathsSet.add(basePathWithoutRootDirectory)
			pathsSet.delete('')
			const newPathsArr = Array.from(pathsSet).sort()
			await configCollection.updateOne({name: "paths"}, {$set: {pathsArr: newPathsArr}}, function (err) {
				if (err) {
					console.log("Oops!- configCollection updateOne pathArr Error - ", err)
					throw createError(400, `configCollection updateOne pathArr error`)
				}
			})
		}
	})
}

module.exports = {addPathToBase}
