const fs = require('fs-extra')
const {MongoClient} = require('mongodb')
const ObjectId = require('mongodb').ObjectID
const exiftool = require('node-exiftool')
const exiftoolBin = require('dist-exiftool')
const {updateFileDataWithFilePath} = require("./Data")
const {pushExif, getExifFormPhoto} = require("../utils/exifTool")
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const {
	originalFiledata,
	updateFiledata,
	videoOriginalFileData,
	videoUpdatedData,
	updatedFileDateForReturningValues,
	pushExifFiledata
} = require("./Data")
const {deepCopy, renameFile, DBFilters} = require("../utils/common")
const {
	renameFileIfNeeded,
	isDifferentNames,
	findObjects,
	updateDatabase,
	updateFile,
	updateRequest,
	getPreviewArray,
	movePreviewFile,
	moveFile
} = require("../requests/updateRequest")

describe('updateRequest: ', () => {
	let req = {
		app: {locals: {collection: null}},
		body: null
	}
	let res = {send: null}
	
	let testCollections
	let connection
	let db
	
	beforeAll(async () => {
		connection = await MongoClient.connect("mongodb://localhost:27017/", {
			useUnifiedTopology: true,
			useNewUrlParser: true
		})
		db = await connection.db('IDB')
		testCollections = db.collection('test')
	})
	
	beforeEach(async () => {
		req.body = deepCopy(updateFiledata)
		
		// Collection creating
		await testCollections.insertMany(originalFiledata, function (err) {
			if (err) {
				console.log("testCollections insert error", err)
			}
			console.log("testCollections is created")
		})
		req.app.locals.collection = testCollections
	})
	
	afterEach(async () => {
		// Collection cleaning
		const deleteObject = DBFilters.getFilterByIds(originalFiledata.map(item => item._id))
		await req.app.locals.collection.deleteMany(deleteObject)
	})
	
	afterAll(async () => {
		fs.copySync('tests/tempPhotos/YDXJ1442.mp4', 'tests/tempVideos', { overwrite: true })
		await connection.close()
	})
	
	describe('updateFile: ', () => {
		test('should return correct response.value from database', async () => {
			const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"}"
			const id = "5fef484b497f3af84699e88c"
			const updatedFields = Object.assign(updateFiledata[1].updatedFields)
			const filedata = Object.assign(originalFiledata[0])
			const collection = req.app.locals.collection
			const response = await updateFile(id, updatedFields, filedata, collection)
			expect(JSON.stringify(response)).toBe(correctResponse)
		})
		test('should return correct response.value from database if send new filePath', async () => {
			const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.24\",\"filePath\":\"tests/testDirectory/проверка локализации/123.jpg\",\"preview\":\"\"}"
			const id = "5fef484b497f3af84699e88c"
			const updatedFields = Object.assign(updateFileDataWithFilePath[0].updatedFields)
			const filedata = Object.assign(originalFiledata[0])
			const collection = req.app.locals.collection
			const response = await updateFile(id, updatedFields, filedata, collection)
			expect(JSON.stringify(response)).toBe(correctResponse)
		})
		test('should return correct response.value from database if send ONLY filePath', async () => {
			const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"image001-map.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"map\",\"forest\",\"estonia\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2010.10.10\",\"filePath\":\"tests/testDirectory/проверка локализации/image001-map.jpg\",\"preview\":\"\"}"
			const id = "5fef484b497f3af84699e88c"
			const updatedFields = Object.assign(updateFileDataWithFilePath[0].updatedFields)
			const currentUploadingFields = { filePath: updatedFields.filePath }
			const filedata = Object.assign(originalFiledata[0])
			const collection = req.app.locals.collection
			const response = await updateFile(id, currentUploadingFields, filedata, collection)
			expect(JSON.stringify(response)).toBe(correctResponse)
		})
		test('should return correct preview from database if send new originalName', async () => {
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			
			const correctResponse = "{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2021.07.26\",\"filePath\":\"tests/tempVideos/bom-bom.mp4\",\"preview\":\"tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png\"}"
			const id = "60fd9b60e52cbf5832df4bb7"
			const updatedFields = { ...videoUpdatedData[0].updatedFields }
			const filedata = { ...videoOriginalFileData[0] }
			
			const response = await updateFile(id, updatedFields, filedata, testCollections)
			expect(JSON.stringify(response)).toBe(correctResponse)
			
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await testCollections.deleteMany(deleteObject)
		})
	})
	describe('updateDatabase: ', () => {
		test('should return correct Array of updated data', async () => {
			const firstResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.24\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\"}"
			const secondResponse = "{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"}"
			const filedata = req.body
			const collection = req.app.locals.collection
			const fileDataArr = deepCopy(originalFiledata)
			const response = await updateDatabase(filedata, fileDataArr, collection)
			expect(JSON.stringify(response[0])).toBe(firstResponse)
			expect(JSON.stringify(response[1])).toBe(secondResponse)
		})
		test('should correctly update video file', async () => {
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			req.app.locals.collection = testCollections
			
			const updatedFiles = deepCopy(videoUpdatedData)
			const videoFormatResponse = "{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2021.07.26\",\"filePath\":\"tests/tempVideos/bom-bom.mp4\",\"preview\":\"tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png\"}"
			const collection = req.app.locals.collection
			const response = await updateDatabase(updatedFiles, videoOriginalFileData, collection)
			expect(JSON.stringify(response[0])).toBe(videoFormatResponse)
			
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await testCollections.deleteMany(deleteObject)
		})
	})
	describe('findObject: ', () => {
		test('should return found objects from DB', async () => {
			const firstResponse = JSON.stringify(originalFiledata[0])
			const secondResponse = JSON.stringify(originalFiledata[1])
			
			const idsArr = originalFiledata.map(item => item._id)
			const collection = req.app.locals.collection
			const response = await findObjects(idsArr, collection)
			
			expect(JSON.stringify(response[0])).toBe(firstResponse)
			expect(JSON.stringify(response[1])).toBe(secondResponse)
		})
		
		test('should throw Error if cant find object in DB', async () => {
			const id1 = ObjectId("5fef484b497f3af84699e77b")
			const id2 = ObjectId("5fef484b497f3af84699e77c")
			const idsArr = [id1, id2]
			const collection = req.app.locals.collection
			try {
				await findObjects(idsArr, collection)
			} catch (error) {
				expect(error.message).toBe('OOPS! ERROR: "findObjects" can\'t find DB object')
			}
		})
	})
	describe('isDifferentNames: ', () => {
		test('should return ERROR if originalName is duplicated', () => {
			const fileDataItem = req.body[0]
			const duplicatedFileDataItem = {
				...fileDataItem,
				updatedFields: {originalName: originalFiledata[0].originalName}
			}
			try {
				isDifferentNames(originalFiledata[0], duplicatedFileDataItem)
			} catch (error) {
				expect(error.message).toBe('ERROR - isDifferentNames: duplicated originalName')
			}
		})
		test('should return "true" if originalNames are different', () => {
			expect(isDifferentNames(originalFiledata[0], updateFiledata[0])).toBeTruthy()
		})
	})
	describe('renameFileIfNeeded: ', () => {
		test('should rename file if updateFiledata has originalName field', async () => {
			const updatedFileName = 'tests/test-images/123.jpg'
			const {newNamePath, newPreviewPath} = await renameFileIfNeeded(originalFiledata[0], updateFiledata[0], '')
			expect(newNamePath).toBe(updatedFileName)
			expect(newPreviewPath).toBe('')
			
			await renameFile(updatedFileName, originalFiledata[0].filePath)
			expect(fs.existsSync(originalFiledata[0].filePath)).toBe(true)
		})
		test('should return "false" if updateFiledata does not has originalName field', async () => {
			const updateFiledataItem = req.body[1]
			delete updateFiledataItem.updatedFields.originalName
			const response = await renameFileIfNeeded(originalFiledata[0], updateFiledataItem, '')
			expect(response).toBeFalsy()
		})
		test('should return "false" if updateFiledata has filePath', async () => {
			const response = await renameFileIfNeeded(originalFiledata[0], deepCopy(updateFileDataWithFilePath[0]), '')
			expect(response).toBeFalsy()
		})
		test('should return ERROR if originalName is duplicated', async () => {
			const fileDataItem = req.body[0]
			const duplicatedFileDataItem = {
				...fileDataItem,
				updatedFields: {originalName: originalFiledata[0].originalName}
			}
			try {
				await renameFileIfNeeded(originalFiledata[0], duplicatedFileDataItem)
			} catch (error) {
				expect(error.message).toBe('ERROR - isDifferentNames: duplicated originalName')
			}
		})
		test('should correctly rename video file and return renamed file and thumbnail', async () => {
			const resultNamePath = 'tests/tempVideos/bom-bom.mp4'
			const resultPreviewPath = 'tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png'
			const {newNamePath, newPreviewPath} = await renameFileIfNeeded(videoOriginalFileData[0], deepCopy(videoUpdatedData)[0])
			
			expect(newNamePath).toBe(resultNamePath)
			expect(newPreviewPath).toBe(resultPreviewPath)
			
			await renameFile(newNamePath, videoOriginalFileData[0].filePath)
			await renameFile(newPreviewPath, videoOriginalFileData[0].preview)
			expect(fs.existsSync(videoOriginalFileData[0].filePath)).toBeTruthy()
			expect(fs.existsSync(videoOriginalFileData[0].preview)).toBeTruthy()
			expect(fs.existsSync(resultNamePath)).toBeFalsy()
			expect(fs.existsSync(resultPreviewPath)).toBeFalsy()
		})
	})
	describe('getPreviewArray: ', () => {
		test('should return preview paths array', () => {
			const DBObjectsArr = [ ...originalFiledata, ...videoOriginalFileData ]
			const previewArr = getPreviewArray(DBObjectsArr)
			
			expect(previewArr).toHaveLength(1)
			expect(previewArr[0]).toBe('tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png')
		})
	})
	describe('movePreviewFile: ', () => {
		test('should move preview file to a new directory', async () => {
			const originalFileDataItem = deepCopy(videoOriginalFileData[0])
			const filePathWithoutName = 'tests/testDirectory/проверка локализации'
			const newFullFileName = filePathWithoutName + '/YDXJ1442-thumbnail-1000x562-0001.png'
			
			await movePreviewFile(originalFileDataItem, filePathWithoutName, undefined)
			expect(fs.existsSync(newFullFileName)).toBeTruthy()
			
			// return place
			fs.moveSync(newFullFileName, originalFileDataItem.preview)
		})
		test('should move preview file and update file name', async () => {
			const originalFileDataItem = deepCopy(videoOriginalFileData[0])
			const filePathWithoutName = 'tests/testDirectory/проверка локализации'
			const newFileName = 'песня про озеро.png'
			const newFullFileName = `${filePathWithoutName}/песня про озеро-thumbnail-1000x562-0001.png`
			
			await movePreviewFile(originalFileDataItem, filePathWithoutName, newFileName)
			expect(fs.existsSync(newFullFileName)).toBeTruthy()
			
			// return place
			fs.moveSync(newFullFileName, originalFileDataItem.preview)
		})
		test('should return correct new full file name', async () => {
			const originalFileDataItem = deepCopy(videoOriginalFileData[0])
			const filePathWithoutName = 'tests/testDirectory/проверка локализации'
			const newPreviewName = 'песня про озеро.png'
			const newFullPreviewName = `${filePathWithoutName}/песня про озеро-thumbnail-1000x562-0001.png`
			
			const resultFullPreviewName = await movePreviewFile(originalFileDataItem, filePathWithoutName, newPreviewName)
			
			expect(resultFullPreviewName).toBe(newFullPreviewName)
			
			// return place
			fs.moveSync(resultFullPreviewName, originalFileDataItem.preview)
		})
		test('should return an Error if there is no original file', async () => {
			const originalFileDataItem = deepCopy(videoOriginalFileData[0])
			originalFileDataItem.preview = 'tests/wrong directory/YDXJ1442-thumbnail-1000x562-0001.png'
			const filePathWithoutName = 'tests/testDirectory/проверка локализации'
			
			try {
				await movePreviewFile(originalFileDataItem, filePathWithoutName, undefined)
			} catch (error) {
				expect(error.message).toBe(`movePreviewFile: fs.move Error: ENOENT: no such file or directory, stat '${originalFileDataItem.preview}' - tests/testDirectory/проверка локализации/YDXJ1442-thumbnail-1000x562-0001.png`)
			}
		})
	})
	describe('moveFile: ', () => {
		test('should return Error if there is fs.copy Error', async () => {
			const originalName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const destWithoutName = 'tests/testDirectory/проверка локализации'
			const newFilePath = '123.jpg'
			
			fs.copySync(originalFilePath, destWithoutName + '/' + newFilePath)
			try {
				await moveFile(originalFilePath, destWithoutName, originalName, '', newFilePath)
			} catch (error) {
				expect(error.message).toBe(`fs.copy Error: '${destWithoutName}/${newFilePath}' already exists`)
			}

			// remove copied file
			fs.removeSync(destWithoutName + '/' + newFilePath)
		})
		test('should return Error if there is fs.move Error', async () => {
			const originalName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const destWithoutName = 'tests/testDirectory/проверка локализации'
			
			fs.copySync(originalFilePath, destWithoutName + '/' + originalName)
			try {
				await moveFile(originalFilePath, destWithoutName, originalName, '')
			} catch (error) {
				expect(error.message).toBe(`fs.move Error: dest already exists. - ${destWithoutName}/${originalName}`)
			}
			
			// remove copied file
			fs.removeSync(destWithoutName + '/' + originalName)
		})
		test('should move file', async () => {
			const originalName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const destWithoutName = 'tests/testDirectory/проверка локализации'
			const newFullPath = destWithoutName + '/' + originalName
			
			try {
				await moveFile(originalFilePath, destWithoutName, originalName, '')
			} catch (error) {
				console.log(error)
			}
			
			expect(fs.existsSync(newFullPath)).toBeTruthy()
			expect(fs.existsSync(originalFilePath)).toBeFalsy()
			
			//return file place
			fs.moveSync(newFullPath, originalFilePath)
		})
		test('should move file and update file name', async () => {
			const originalName = 'image001-map.jpg'
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const destWithoutName = 'tests/testDirectory/проверка локализации'
			const newFileName = '123.jpg'
			const newFullPath = destWithoutName + '/' + newFileName
			
			try {
				await moveFile(originalFilePath, destWithoutName, originalName, '', newFileName)
			} catch (error) {
				console.log(error)
			}
			
			expect(fs.existsSync(newFullPath)).toBeTruthy()
			expect(fs.existsSync(originalFilePath)).toBeFalsy()
			
			//return file place
			fs.copySync(newFullPath, originalFilePath)
			fs.removeSync(newFullPath)
		})
	})
	describe('updateRequest: ', () => {
		let updatedFileDateForReturning
		let exifFiledata
		let originalData
		let keywordsArrForReturning
		let pathsArr
		
		beforeEach(async () => {
			req.body = deepCopy(updateFiledata)
			updatedFileDateForReturning = deepCopy(updatedFileDateForReturningValues)
			originalData = [...originalFiledata] //don't use deepCopy in this case!!!
			exifFiledata = deepCopy(pushExifFiledata)
			keywordsArrForReturning = updatedFileDateForReturningValues.map(dataItem => dataItem.updatedFields.keywords)
			pathsArr = originalData.map(dataItem => dataItem.filePath)

			req.app.locals.collection = testCollections
		})
		
		afterEach(async () => {
			await pushExif(pathsArr, keywordsArrForReturning, exifFiledata, exiftoolProcess)
			
			// Collection cleaning
			const deleteObject = DBFilters.getFilterByIds(originalData.map(item => item._id))
			await req.app.locals.collection.deleteMany(deleteObject)
		})
		
		test('should return message "update request - File loading error" if there is no req.body', async () => {
			res.send = jest.fn(value => value)
			delete req.body
			await updateRequest(req, res)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith("update request - File loading error")
		})
		test('should send Error message "fs.copy Error: ... already exists" if there is fs.copy Error', async () => {
			req.body = deepCopy(updateFileDataWithFilePath)
			res.send = jest.fn(value => JSON.stringify(value))
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const newFilePath = 'tests/testDirectory/проверка локализации/123.jpg'

			fs.copySync(originalFilePath, newFilePath)
			await updateRequest(req, res, exiftoolProcess)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith("{\"error\":\"fs.copy Error: 'tests/testDirectory/проверка локализации/123.jpg' already exists\"}")

			//return file place
			fs.removeSync(newFilePath)
		})
		test('should send Error message "fs.move Error: dest already exists..." if there is fs.move Error', async () => {
			req.body = deepCopy(updateFileDataWithFilePath)
			req.body[0].updatedFields.originalName = undefined
			res.send = jest.fn(value => JSON.stringify(value))
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const newFileName = 'tests/testDirectory/проверка локализации/image001-map.jpg'

			fs.copySync(originalFilePath, newFileName)
			await updateRequest(req, res, exiftoolProcess)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith("{\"error\":\"fs.move Error: dest already exists. - tests/testDirectory/проверка локализации/image001-map.jpg\"}")

			//return file place
			fs.removeSync(newFileName)
		})
		test('should rename file if updateFiledata has originalName field', async () => {
			const updatedFileName1 = 'tests/test-images/123.jpg'
			const updatedFileName2 = 'tests/test-images/bom-bom.jpg'
			res.send = jest.fn(value => value)
			await updateRequest(req, res, exiftoolProcess)
			expect(fs.existsSync(updatedFileName1)).toBe(true)
			expect(fs.existsSync(updatedFileName2)).toBe(true)
			await renameFile(updatedFileName1, originalData[0].filePath)
			await renameFile(updatedFileName2, originalData[1].filePath)
		})
		test('should rewrite exif', async () => {
			const updatedFileName1 = 'tests/test-images/123.jpg'
			const updatedFileName2 = 'tests/test-images/bom-bom.jpg'
			const response = {send: null}
			const request = {
				app: {locals: {collection: null}},
				body: null
			}
			response.send = jest.fn(value => value)
			request.body = deepCopy(updateFiledata)
			request.app.locals.collection = testCollections


			const originalExif = await getExifFormPhoto(originalData[1].filePath, exiftoolProcess)
			expect(JSON.stringify(originalExif[0].Keywords)).toBe("[\"bike\",\"Olga\",\"estonia\"]")
			expect(originalExif[0].DateTimeOriginal).toBe('2019:06:24 12:00:00')

			await updateRequest(request, response, exiftoolProcess)

			const updatedExif1 = await getExifFormPhoto(updatedFileName1, exiftoolProcess)
			const updatedExif2 = await getExifFormPhoto(updatedFileName2, exiftoolProcess)
			expect(updatedExif1[0]?.Keywords).toBeUndefined()
			expect(updatedExif2[0].Keywords).toBe('green')
			expect(updatedExif1[0].DateTimeOriginal).toBe('2019:06:24 12:00:00')
			expect(updatedExif2[0].DateTimeOriginal).toBe('2019:06:20 12:00:00')

			await renameFile(updatedFileName1, originalData[0].filePath)
			await renameFile(updatedFileName2, originalData[1].filePath)
		})
		test('should return correct response.value from updateRequest', async () => {
			const updatedFileName1 = 'tests/test-images/123.jpg'
			const updatedFileName2 = 'tests/test-images/bom-bom.jpg'
			const updatedFileName3 = 'tests/testDirectory/проверка локализации/bom-bom.mp4'
			const updatedFileName4 = 'tests/testDirectory/проверка локализации/bom-bom-thumbnail-1000x562-0001.png'
			const correctResponse = "[{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.24\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\"},{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"},{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2021.07.26\",\"filePath\":\"tests/testDirectory/проверка локализации/bom-bom.mp4\",\"preview\":\"tests/testDirectory/проверка локализации/bom-bom-thumbnail-1000x562-0001.png\"}]"
			// const correctResponse = [
			// 	{_id: '5fef484b497f3af84699e88c',
			// 		originalName:'123.jpg',
			// 		mimetype:'image/jpeg',
			// 		size:2000000,
			// 		megapixels:8,
			// 		imageSize:'3000x3000',
			// 		keywords:[],
			// 		changeDate:'11.11.2011',
			// 		originalDate:'24.06.2019',
			// 		filePath:'tests/test-images/123.jpg.jpg',
			// 		preview:"",
			// 	},{_id:'5fef4856497f3af84699e77e',
			// 		originalName:'bom-bom.jpg',
			// 		mimetype:'image/jpeg',
			// 		size:1000000,
			// 		megapixels:10,imageSize:'2000x2000',
			// 		keywords:['green'],
			// 		changeDate:'12.12.2011',
			// 		originalDate:'20.06.2019',
			// 		filePath:'tests/test-images/bom-bom.jpg.jpg',
			// 		preview:""
			// },{_id: '60fd9b60e52cbf5832df4bb7',
			// 	  originalName: 'bom-bom.mp4',
			// 		mimetype: 'video/mp4',
			// 		size: 2000000,
			// 		megapixels: 8,
			// 		imageSize: '3000x3000',
			// 		keywords: ['green', 'песня про озеро'],
			// 		changeDate: '2011.11.11',
			// 		originalDate: '2021.07.26',
			// 		filePath: 'tests/testDirectory/проверка локализации/bom-bom.mp4',
			// 		preview: 'tests/testDirectory/проверка локализации/bom-bom-thumbnail-1000x562-0001.png',
			// }]
			
			res.send = jest.fn(value => JSON.stringify(value))
			req.body = [ ...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData) ]
			req.body[2].updatedFields.filePath = 'tests/testDirectory/проверка локализации'
			
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			
			await updateRequest(req, res, exiftoolProcess)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith(correctResponse)

			// return place
			await renameFile(updatedFileName1, originalData[0].filePath)
			await renameFile(updatedFileName2, originalData[1].filePath)
			await renameFile(updatedFileName3, videoOriginalFileData[0].filePath)
			await renameFile(updatedFileName4, videoOriginalFileData[0].preview)
			
			// Collection cleaning
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await req.app.locals.collection.deleteMany(deleteObject)
		})
		test('should recover files if there is fs.copy Error', async () => {
			req.body = deepCopy(updateFileDataWithFilePath)
			res.send = jest.fn(value => value)
			const originalFilePath1 = 'tests/test-images/image001-map.jpg'
			const originalFilePath2 = 'tests/test-images/image002-map.jpg'
			const newFilePath = 'tests/testDirectory/проверка локализации/123.jpg'

			fs.copySync(originalFilePath1, newFilePath)
			await updateRequest(req, res, exiftoolProcess)

			expect(fs.existsSync(originalFilePath1)).toBeTruthy()
			expect(fs.existsSync(originalFilePath2)).toBeTruthy()

			//return file place
			fs.removeSync(newFilePath)
		})
		test('should recover files if there is fs.move Error', async () => {
			req.body = deepCopy(updateFileDataWithFilePath)
			req.body[0].updatedFields.originalName = undefined
			res.send = jest.fn(value => value)
			const originalFilePath = 'tests/test-images/image001-map.jpg'
			const newFileName = 'tests/testDirectory/проверка локализации/image001-map.jpg'
			
			fs.copySync(originalFilePath, newFileName)
			await updateRequest(req, res, exiftoolProcess)
			
			expect(fs.existsSync(originalFilePath)).toBeTruthy()
			
			//return file place
			fs.removeSync(newFileName)
		})
		test('should recover preview if there is rename Error', async () => {
			req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
			res.send = jest.fn(value => value)
			const originalFilePath = 'tests/tempVideos/YDXJ1442.mp4'
			const originalPreviewPath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
			const newPreviewPath = 'tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png'
			
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			
			fs.copySync(originalPreviewPath, newPreviewPath)
			await updateRequest(req, res, exiftoolProcess)
			
			expect(fs.existsSync(originalFilePath)).toBeTruthy()
			expect(fs.existsSync(originalPreviewPath)).toBeTruthy()
			
			fs.removeSync(newPreviewPath)
			// Collection cleaning
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await req.app.locals.collection.deleteMany(deleteObject)
		})
		test('should recover preview if there is fs.move Error', async () => {
			const newFilePath = 'tests/testDirectory/проверка локализации'
			req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
			req.body[2].updatedFields.filePath = newFilePath
			req.body[2].updatedFields.originalName = undefined
			res.send = jest.fn(value => value)
			const originalPreviewPath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
			const newPreviewPath = `${newFilePath}/YDXJ1442-thumbnail-1000x562-0001.png`
			
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			
			fs.copySync(originalPreviewPath, newPreviewPath)
			await updateRequest(req, res, exiftoolProcess)
			
			expect(fs.existsSync(originalPreviewPath)).toBeTruthy()
			
			fs.removeSync(newPreviewPath)
			// Collection cleaning
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await req.app.locals.collection.deleteMany(deleteObject)
		})
		test('should return an Error if there is movePreviewFile Error', async () => {
			const newFilePath = 'tests/testDirectory/проверка локализации'
			req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
			req.body[2].updatedFields.filePath = newFilePath
			req.body[2].updatedFields.originalName = undefined
			res.send = jest.fn(value => JSON.stringify(value))
			const originalPreviewPath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
			const newPreviewPath = `${newFilePath}/YDXJ1442-thumbnail-1000x562-0001.png`
			const correctResponse = '{\"error\":\"movePreviewFile: fs.move Error: dest already exists. - tests/testDirectory/проверка локализации/YDXJ1442-thumbnail-1000x562-0001.png\"}'
			
			await testCollections.insertMany(videoOriginalFileData, function (err) {
				if (err) {
					console.log("videoFileData insert error", err)
				}
				console.log("videoFileData is created")
			})
			
			fs.copySync(originalPreviewPath, newPreviewPath)
			await updateRequest(req, res, exiftoolProcess)
			
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith(correctResponse)
			
			fs.removeSync(newPreviewPath)
			// Collection cleaning
			const deleteObject = DBFilters.getFilterByIds(videoOriginalFileData.map(item => item._id))
			await req.app.locals.collection.deleteMany(deleteObject)
		})
	})
})
