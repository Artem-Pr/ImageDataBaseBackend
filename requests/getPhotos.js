const fs = require("fs-extra")
const createError = require("http-errors")
const sharp = require("sharp")

//Todo: add tests
const getFilesFromDB = async (req, res, tempFolder, databaseFolder) => {
	
	const url = new URL('http://localhost:5000' + req.url)
	const folderPath = url.searchParams.get('folderPath')
	const nPerPage = +url.searchParams.get('perPage') || 0
	let currentPage = +url.searchParams.get('page') || 1
	let searchTags = url.searchParams.get('searchTags[]') || []
	let excludeTags = url.searchParams.get('excludeTags[]') || []
	
	if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
	if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
	
	console.log('folderPath', folderPath)
	console.log('searchTags', searchTags)
	console.log('excludeTags', excludeTags)
	
	// очищаем temp
	fs.emptyDirSync(tempFolder)
	
	const conditionArr = []
	if (folderPath) {
		const regExp = new RegExp(`/${folderPath}/`)
		conditionArr.push({"filePath": regExp})
	}
	if (searchTags.length) conditionArr.push({"keywords": {$in: searchTags || []}})
	if (excludeTags.length) conditionArr.push({"keywords": {$nin: excludeTags || []}})
	
	const findObject = conditionArr.length ? {$and: conditionArr} : {}
	
	const collection = req.app.locals.collection
	let resultsCount = 0
	let totalPages = 0
	
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
