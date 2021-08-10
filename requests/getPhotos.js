const fs = require("fs-extra")
const createError = require("http-errors")
const sharp = require("sharp")

//Todo: add tests
const getFilesFromDB = async (req, res, tempFolder, databaseFolder) => {
	let filedata = req.body
	if (!filedata) res.send("Ошибка при загрузке файлов")
	
	const folderPath = filedata?.folderPath
	const nPerPage = +filedata?.perPage || 0
	let currentPage = +filedata?.page || 1
	let searchTags = filedata?.searchTags || []
	let excludeTags = filedata?.excludeTags || []
	
	if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
	if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
	
	console.log('folderPath', folderPath)
	console.log('searchTags', searchTags)
	console.log('excludeTags', excludeTags)
	
	// очищаем temp
	fs.emptyDirSync(tempFolder)
	
	const conditionArr = []
	if (folderPath) conditionArr.push({$text:{$search:`\"${folderPath}\"`}})
	if (searchTags.length) conditionArr.push({"keywords": {$in: searchTags || []}})
	if (excludeTags.length) conditionArr.push({"keywords": {$nin: excludeTags || []}})
	
	const findObject = conditionArr.length ? {$and: conditionArr} : {}
	
	const collection = req.app.locals.collection
	let resultsCount = 0
	let totalPages = 0
	
	collection.createIndex({filePath: "text"})
	const AllFoundedResults = collection.find(findObject)
	AllFoundedResults.count().then(response => {
		resultsCount = response
		totalPages = Math.ceil(resultsCount / nPerPage)
		if (currentPage > totalPages) currentPage = 1
	})
	AllFoundedResults
		.skip(currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0)
		.limit(nPerPage)
		.toArray(async function (err, photos) {
			if (err) {
				console.log("collection load error", err)
				throw createError(400, `collection load error`)
			}
			
			console.log('rootLibPath -', `"${databaseFolder}"`)
			console.log('Sharp start. Number of photos:', photos.length)
			const filesWithTempPathPromise = photos.map(async item => {
				const fullPath = databaseFolder + item.filePath
				const staticPath = 'database' + item.filePath
				
				// если тип "video", то не делаем превью, а просто достаем его из папки, иначе делаем превью
				if (item.mimetype.startsWith('video')) {
					const fullPreviewPath = 'database' + item.preview
					item.originalPath = 'http://localhost:5000/' + staticPath
					item.preview = 'http://localhost:5000/' + fullPreviewPath
					item.tempPath = item.filePath
				} else {
					const randomName = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
					await sharp(fullPath)
						// .withMetadata()
						.clone()
						.resize(200)
						.jpeg({quality: 80})
						.toFile('temp/' + randomName + '-preview.jpg')
						.then(() => {
							item.originalPath = 'http://localhost:5000/' + staticPath
							item.preview = 'http://localhost:5000/images/' + randomName + '-preview.jpg'
							item.tempPath = item.filePath
							console.log('Sharp SUCCESS:', item.originalName)
						})
						.catch(err => console.log('OOPS!, Sharp ERROR: ', err))
				}
				return item
			})
			const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
			const responseObject = {
				files: filesWithTempPath,
				searchPagination: {currentPage, totalPages, nPerPage, resultsCount}
			}
			res.send(responseObject)
		});
}

module.exports = {getFilesFromDB}
