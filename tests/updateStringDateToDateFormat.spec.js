const {MongoClient, ObjectId} = require("mongodb")
const fs = require('fs-extra')
const {logger} = require("../utils/logger")
const {deepCopy} = require("../utils/common")
const {originalPathsList2} = require("./Data")
const {removeDirController} = require("../requests/removeDirectory")
const {updateStringDateToDateFormat} = require('../utils/updateStringDateToDateFormat')

const originalData = [
    {
        _id: ObjectId("6151f3aa86c6ca71bc443a9a"),
        originalName: 'image001-map.jpg',
        mimetype: 'image/jpeg',
        size: 2000000,
        megapixels: 8,
        imageSize: '3000x3000',
        keywords: ['map', 'forest', 'estonia'],
        changeDate: '2011.11.11',
        originalDate: '2010.10.10',
        filePath: '/tests/testDirectory/проверка локализации/test-folder/test-subfolder/image001-map.jpg',
        preview: '',
    }, {
        _id: ObjectId("5fef4856497f3af84699e77e"),
        originalName: 'image002-map.jpg',
        mimetype: 'image/jpeg',
        size: 1000000,
        megapixels: 10,
        imageSize: '2000x2000',
        keywords: ['bike', 'Olga', 'estonia'],
        changeDate: '2011.12.12',
        originalDate: '2010.01.01',
        filePath: '/tests/testDirectory/image002-map.jpg',
        preview: '',
    }, {
        _id: ObjectId("60fd9b60e52cbf5832df4bb7"),
        originalName: 'YDXJ1442.mp4',
        mimetype: 'video/mp4',
        size: 2000000,
        megapixels: 8,
        imageSize: '3000x3000',
        keywords: null,
        changeDate: '2011.11.11',
        originalDate: '2010.10.10',
        filePath: '/tests/testDirectory/проверка локализации/test-folder/тестовая папка/YDXJ1442.mp4',
        preview: '/tests/testDirectory/проверка локализации/test-folder/тестовая папка/YDXJ1442-thumbnail-1000x562-0001.png',
    }
]

describe('updateStringDateToDateFormat', () => {
    let removingController
    let initialRequest = {
        app: {
            locals: {
                configCollection: null,
                testCollections: null,
            },
        },
        url: '/directory?name=tests%2FtestDirectory%2F%D0%BF%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%BA%D0%B0+%D0%BB%D0%BE%D0%BA%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8'
        // расшифровка кодировки:
        // url: '/directory?name=tests/testDirectory/проверка локализации'
    }
    let req
    let res = {send: jest.fn(value => value)}
    
    let testCollections
    let configCollection
    let connection
    let db
    
    beforeAll(async () => {
        logger.verbose('start beforeAll')
        connection = await MongoClient.connect("mongodb://localhost:27017/", {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })
        db = await connection.db('IDB')
        configCollection = db.collection('testConfig')
        testCollections = db.collection('test')
    })
    
    beforeEach(async () => {
        logger.verbose('start beforeEach')
        req = deepCopy(initialRequest)
        req.app.locals.configCollection = configCollection
        req.app.locals.collection = testCollections
        
        // Collection creating
        try {
            await req.app.locals.collection.insertMany(originalData)
            logger.verbose("testCollections is created")
        } catch (err) {
            logger.verbose("testCollections insert error", err)
        }
        try {
            await req.app.locals.configCollection.insertOne({name: "paths", pathsArr: originalPathsList2})
            logger.verbose("configCollection is created")
        } catch (err) {
            logger.verbose("configCollection insert error", err)
        }
        
        removingController = new removeDirController(res, req)
    })
    
    afterEach(async () => {
        logger.verbose('start afterEach')
        req.app.locals.configCollection && await req.app.locals.configCollection.deleteMany({})
        req.app.locals.collection && await req.app.locals.collection.deleteMany({})
        removingController = null
    })
    
    afterAll(async () => {
        logger.verbose('start afterAll')
        await connection.close()
    })
    
    test(`should update original data to date format`, async () => {
        await updateStringDateToDateFormat(req)
        
        const originalDBCollection = await req.app.locals.collection
            .find()
            // .sort({originalDate: 1, filePath: 1})
            .sort({originalDate: 1})
            .toArray()
        console.log('bom', originalDBCollection)
        expect(originalDBCollection).toHaveLength(3)
    })
})
