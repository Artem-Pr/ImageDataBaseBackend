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
        req.app.locals.configCollection = db.collection('testConfig')
        await req.app.locals.configCollection.insertOne({name: "paths", pathsArr: originalPathsList})
    })
    
    afterEach(async () => {
        req.app.locals.configCollection && await req.app.locals.configCollection.deleteMany({})
    })
    
    test('should create new config in DB if collection is not exists', async () => {
        req.app.locals.configCollection = db.collection('testEmptyConfig')
        
        await addPathToBase(req, testFilePath)
        const config = await req.app.locals.configCollection.findOne({name: "paths"})
        expect(config.pathsArr).toHaveLength(2)
        expect(config.pathsArr).toEqual(["природа", "природа/nature"])
    })
    test('should return an Error if collection is broken', async () => {
        req.app.locals.configCollection = null
        try {
            await addPathToBase(req, testFilePath)
        } catch (error) {
            expect(error.message).toBe(`DBController - findOne: Cannot read property 'findOne' of null`)
        }
    })
    test('should return an empty string if new path exists in pathsArr', async () => {
        const response = await addPathToBase(req, existingFilePath)
        expect(response).toBe('')
    })
    test('should add new path to pathsArr', async () => {
        await addPathToBase(req, testFilePath)
        const {pathsArr} = await req.app.locals.configCollection.findOne({name: "paths"})
        expect(pathsArr).toHaveLength(17)
        expect(pathsArr.includes(testFilePath)).toBeTruthy()
    })
    test('should return updated pathsArr after adding path to pathsArr', async () => {
        const response = await addPathToBase(req, testFilePath)
        expect(response).toEqual([...originalPathsList, testFilePath].sort())
    })
})
