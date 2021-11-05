const {deepCopy} = require("../utils/common")
const {checkDirectory} = require("../requests/checkDirectory")
const {MongoClient} = require("mongodb");
const {originalPathsList, originalData} = require("./Data")

const wrongUrl = '/check-directory?directory=allPhotos%2F%D0%98%D1%81%D0%BF%D0%B0%D0%BD%D0%B8%D1%8F'

describe('checkDirectory', () => {
    let initialRequest = {
        app: {
            locals: {
                configCollection: null,
                testCollections: null,
            },
        },
        url: '/check-directory?directory=tests%2Ftest-images'
    }
    let req
    let res = {send: jest.fn(value => value)}
    
    let testCollections
    let configCollection
    let connection
    let db
    
    beforeAll(async () => {
        console.log('start beforeAll')
        connection = await MongoClient.connect("mongodb://localhost:27017/", {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })
        db = await connection.db('IDB')
        configCollection = db.collection('testConfig')
        testCollections = db.collection('test')
    })
    
    beforeEach(async () => {
        console.log('start beforeEach')
        req = deepCopy(initialRequest)
        req.app.locals.configCollection = configCollection
        req.app.locals.collection = testCollections
        
        const updateFilePath = (fileData) => fileData.map(item => ({...item, filePath: `/${item.filePath}`}))
        
        // Collection creating
        try {
            await req.app.locals.collection.insertMany(updateFilePath(originalData))
            console.log("testCollections is created")
        } catch (err) {
            console.log("testCollections insert error", err)
        }
        try {
            await req.app.locals.configCollection.insertOne({name: "paths", pathsArr: originalPathsList})
            console.log("configCollection is created")
        } catch (err) {
            console.log("configCollection insert error", err)
        }
    })
    
    afterEach(async () => {
        console.log('start afterEach')
        await req.app.locals.configCollection.deleteMany({})
        await req.app.locals.collection.deleteMany({})
    })
    
    afterAll(async () => {
        console.log('start afterAll')
        await connection.close()
    })
    
    test('should send an ERROR if param is empty', async () => {
        req.url = '/check-directory?test=34'
        await checkDirectory(req, res)
        expect(res.send).toBeCalled()
        expect(res.send).toBeCalledWith({error: 'Request does not contain a required parameter'})
    })
    
    test('should send an ERROR if there are no matching directories', async () => {
        req.url = wrongUrl
        await checkDirectory(req, res)
        expect(res.send).toBeCalled()
        expect(res.send).toBeCalledWith({error: 'There are no matching directories'})
    })
    
    test('should send number of files and subdirectories in current directory', async () => {
        await checkDirectory(req, res)
        expect(res.send).toBeCalled()
        expect(res.send).toBeCalledWith({success: true, numberOfFiles: 2, numberOfSubdirectories: 1})
    })
})
