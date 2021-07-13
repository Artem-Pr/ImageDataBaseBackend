const fs = require('fs-extra')
const {MongoClient} = require('mongodb')
const ObjectId = require('mongodb').ObjectID
const exiftool = require('node-exiftool')
const exiftoolBin = require('dist-exiftool')
const {pushExif, getExifFormPhoto} = require("../utils/exifTool")
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const {
	originalFiledata,
	updateFiledata,
	updatedFileDateForReturningValues,
	pushExifFiledata
} = require("./Data")
const {renameFile, DBFilters} = require("../utils/common")
const {
	renameFileIfNeeded,
	updateNamePath,
	isDifferentNames,
	findObjects,
	updateDatabase,
	updateFile,
	updateRequest
} = require("../requests/updateRequest")

const deepCopy = obj => JSON.parse(JSON.stringify(obj))

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
		await connection.close()
	})
	
	describe('updateFile: ', () => {
		test('should return correct response.value from database', async () => {
			const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"}"
			const id = "5fef484b497f3af84699e88c"
			const updatedFields = Object.assign(updateFiledata[1].updatedFields)
			const collection = req.app.locals.collection
			const response = await updateFile(id, updatedFields, collection, res)
			expect(JSON.stringify(response)).toBe(correctResponse)
		})
	})
	
	describe('updateDatabase: ', () => {
		test('should return correct Array of updated data', async () => {
			const firstResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.24\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\"}"
			const secondResponse = "{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"}"
			const filedata = req.body
			const collection = req.app.locals.collection
			const response = await updateDatabase(filedata, collection, res)
			expect(JSON.stringify(response[0])).toBe(firstResponse)
			expect(JSON.stringify(response[1])).toBe(secondResponse)
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
	
	describe('updateNamePath: ', () => {
		test('should return new namePath', async () => {
			const newNamePath = updateNamePath(originalFiledata[0], updateFiledata[0])
			expect(newNamePath).toBe('tests/test-images/123.jpg')
		})
	})
	
	describe('renameFileIfNeeded: ', () => {
		test('should rename file if updateFiledata has originalName field', async () => {
			const updatedFileName = 'tests/test-images/123.jpg'
			const response = await renameFileIfNeeded(originalFiledata[0], updateFiledata[0])
			expect(response).toBe(updatedFileName)
			await renameFile(updatedFileName, originalFiledata[0].filePath)
			expect(fs.existsSync(originalFiledata[0].filePath)).toBe(true)
		})
		test('should return "false" if updateFiledata does not has originalName field', async () => {
			const updateFiledataItem = req.body[1]
			delete updateFiledataItem.updatedFields.originalName
			const response = await renameFileIfNeeded(originalFiledata[0], updateFiledataItem)
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
		
		test('should return message "update request - File loading error" if there are no req.body', async () => {
			res.send = jest.fn(value => value)
			delete req.body
			await updateRequest(req, res)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith("update request - File loading error")
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
			// image001-map
			
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
			const correctResponse = "[{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"originalDate\":\"2019.06.24\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\"},{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"originalDate\":\"2019.06.20\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\"}]"
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
			// }]
			res.send = jest.fn(value => JSON.stringify(value))
			await updateRequest(req, res, exiftoolProcess)
			expect(res.send).toBeCalled()
			expect(res.send).lastReturnedWith(correctResponse)
			// image001-map

			await renameFile(updatedFileName1, originalData[0].filePath)
			await renameFile(updatedFileName2, originalData[1].filePath)
		})
	})
})
