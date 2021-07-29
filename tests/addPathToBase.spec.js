const {MongoClient} = require('mongodb')
const {addPathToBase} = require("../utils/addPathToBase")
const {originalPathsList} = require("./Data")

describe('addPathToBase: ', () => {
	const testFilePath = 'природа/nature'
	const existingFilePath = 'природа/корпоратив'
	let req = {
		app: {locals: {configCollection: null}},
		body: null
	}
	let emptyConfigCollection
	let configCollection
	let connection
	let db
	
	beforeAll(async () => {
		connection = await MongoClient.connect("mongodb://localhost:27017/", {
			useUnifiedTopology: true,
			useNewUrlParser: true
		})
		db = await connection.db('IDB')
	})
	
	beforeEach(async () => {
		configCollection = db.collection('testConfig')
		req.app.locals.configCollection = configCollection
		await configCollection.insertOne({name: "paths", pathsArr: originalPathsList})
	})
	
	afterEach(async () => {
		await configCollection.deleteMany({})
	})
	
	afterAll(async () => {
		// await emptyConfigCollection.deleteMany({})
	})
	
	test('should create new config in DB if collection is not exists', async () => {
		emptyConfigCollection = db.collection('testEmptyConfig')
		req.app.locals.configCollection = emptyConfigCollection
		
		await addPathToBase(req, testFilePath)
		const config = await emptyConfigCollection.findOne({name: "paths"})
		expect(config.pathsArr).toHaveLength(1)
		expect(config.pathsArr[0]).toBe(testFilePath)
		
		await req.app.locals.configCollection.drop()
	})
	test('should return an Error if collection is broken', async () => {
		req.app.locals.configCollection = null
		try {
			await addPathToBase(req, testFilePath)
		} catch (error) {
			expect(error.message).toBe(`addPathToBase ERROR: insert path - ${testFilePath}, TypeError: Cannot read property 'findOne' of null`)
		}
	})
	test('should return an empty string if new path exists in pathsArr', async () => {
		const response = await addPathToBase(req, existingFilePath)
		expect(response).toBe('')
	})
	test('should add new path to pathsArr', async () => {
		await addPathToBase(req, testFilePath)
		const { pathsArr } = await configCollection.findOne({name: "paths"})
		expect(pathsArr).toHaveLength(13)
		expect(pathsArr.includes(testFilePath)).toBeTruthy()
	})
	test('should return new filePath after adding it to pathsArr', async () => {
		const response = await addPathToBase(req, testFilePath)
		expect(response).toBe(testFilePath)
	})
})
