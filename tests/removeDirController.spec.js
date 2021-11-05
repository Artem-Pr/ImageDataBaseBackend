const {MongoClient, ObjectId} = require("mongodb")
const fs = require('fs-extra')
const {logger} = require("../utils/logger")
const {deepCopy} = require("../utils/common")
const {originalPathsList2} = require("./Data")
const {removeDirController} = require("../requests/removeDirectory")
const {DBController, DBRequests} = require("../utils/DBController");

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

const wrongUrl = '/directory?name=allPhotos%2F%D0%98%D1%81%D0%BF%D0%B0%D0%BD%D0%B8%D1%8F'

describe('removeDirController', () => {
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
    
    test(`should throw error if controller wasn't init properly`, () => {
        try {
            removingController = new removeDirController()
        } catch (error) {
            expect(error.message).toBe('Cannot read property \'url\' of undefined')
        }
    })
    
    describe('fetchPathsConfig:', () => {
        test(`should throw an Error if can't find configCollection`, async () => {
            req.app.locals.configCollection = null
            try {
                await removingController.fetchPathsConfig()
            } catch (error) {
                expect(error.message).toBe("DBController - findOne: Cannot read property 'findOne' of null")
            }
        })
        test(`should throw an Error if can't find pathsArr config field`, async () => {
            await req.app.locals.configCollection.deleteMany({})
            await req.app.locals.configCollection.insertOne({name: "paths", wrongPathsArrName: originalPathsList2})
            removingController = new removeDirController(res, req)
            try {
                await removingController.fetchPathsConfig()
            } catch (error) {
                expect(error.message).toBe("Cannot find property 'pathsArr' in pathConfig")
            }
        })
        test(`should return pathsArr config`, async () => {
            await removingController.fetchPathsConfig()
            expect(removingController.pathsConfigArr).toEqual(originalPathsList2)
        })
    })
    describe('updatePathsConfig:', () => {
        test(`should throw an Error if there is no param`, async () => {
            try {
                await removingController.updatePathsConfig()
            } catch (error) {
                expect(error.message).toBe("required \"pathsConfig\" param")
            }
        })
        test(`should return an Error if can't find pathsArr config`, async () => {
            await req.app.locals.configCollection.deleteMany({})
            await req.app.locals.configCollection.insertOne({wrongName: "paths", pathsArr: originalPathsList2})
            expect(
                removingController.updatePathsConfig(["bom/Банско", "bom/Оля"])
            ).rejects.toEqual(Error("Paths array wasn't update"))
        })
        test(`should update config`, async () => {
            const response = await removingController.updatePathsConfig(["bom/Банско", "bom/Оля"])
            await removingController.fetchPathsConfig()
            expect(response).toBe(1)
            expect(removingController.pathsConfigArr).toEqual(["bom/Банско", "bom/Оля"])
        })
    })
    describe('getConfigWithoutTargetFolder:', () => {
        test('return null if there is no pathsConfigArr', () => {
            this.pathsConfigArr = undefined
            const config = removingController.getConfigWithoutTargetFolder()
            expect(config).toBeNull()
        })
        test('return updated config', async () => {
            await removingController.fetchPathsConfig()
            const config = removingController.getConfigWithoutTargetFolder()
            expect(config).toEqual(['tests', 'tests/testDirectory'])
        })
    })
    describe('removeDirFromConfig:', () => {
        test('should throw an Error if there is no such directory in pathsArr', async () => {
            req.url = wrongUrl
            removingController = new removeDirController(res, req)
            try {
                await removingController.removeDirFromConfig()
            } catch (error) {
                expect(error.message).toBe("Config doesn't contain target directory")
            }
        })
        test('should update "pathsArr" config', async () => {
            await removingController.removeDirFromConfig()
            await removingController.fetchPathsConfig()
            expect(removingController.pathsConfigArr).toEqual(['tests', 'tests/testDirectory'])
        })
    })
    describe('removeDBFilesByDirectory:', () => {
        test(`should throw an Error if database doesn't contain appropriate files`, async () => {
            req.url = wrongUrl
            removingController = new removeDirController(res, req)
            try {
                await removingController.removeDBFilesByDirectory()
            } catch (error) {
                expect(error.message).toBe('files weren\'t deleted from database, may be DB doesn\'t contain appropriate files')
            }
        })
        test(`should remove target files from database`, async () => {
            const testController = new DBController(req, DBRequests.byFieldUsingStartsWith('filePath', `/tests/testDirectory/проверка локализации`))
            
            // find target files in collection before removing (there should be two of them)
            const response = await testController.find("collection")
            expect(response).toHaveLength(2)
            await removingController.removeDBFilesByDirectory()
            
            // find target files in collection after removing (there shouldn't be any of them)
            const response2 = await testController.find("collection")
            expect(response2).toHaveLength(0)
            testController.DBRequest = {}
            
            // find any files in collection after removing (there should be one file)
            const response3 = await testController.find("collection")
            expect(response3).toHaveLength(1)
        })
    })
    describe('startRemovingPipeline:', () => {
        const originalFilePath = 'tests/test-images/image001-map.jpg'
        const originalVideoPath = 'tests/tempVideos/YDXJ1442.mp4'
        const newFilePath = 'tests/testDirectory/проверка локализации/test-folder/test-subfolder/image001-map.jpg'
        const newVideoFile = 'tests/testDirectory/проверка локализации/test-folder/тестовая папка/YDXJ1442.mp4'
        
        beforeEach(() => {
            logger.verbose('start beforeAll')
            fs.mkdirpSync('tests/testDirectory/проверка локализации/test-folder/test-subfolder/')
            fs.mkdirpSync('tests/testDirectory/проверка локализации/test-folder/тестовая папка')
            fs.copySync(originalFilePath, newFilePath)
            fs.copySync(originalVideoPath, newVideoFile)
        })
        afterEach(() => {
            logger.verbose('start afterAll')
            fs.removeSync('tests/testDirectory/проверка локализации')
            fs.mkdirpSync('tests/testDirectory/проверка локализации')
        })
        test(`should correctly remove target directory`, async () => {
            const testDBController = new DBController(req, DBRequests.directoriesList)
            
            // check original pathsArr config
            const {pathsArr: paths} = await testDBController.findOne('configCollection')
            expect(paths).toEqual(originalPathsList2)
            
            // check all original files in DB collection
            testDBController.DBRequest = {}
            const originalDBCollection = await testDBController.find("collection")
            expect(originalDBCollection).toHaveLength(3)
            
            // check original files in DB collection that are in the target directory
            testDBController.DBRequest = DBRequests.byFieldUsingStartsWith('filePath', `/tests/testDirectory/проверка локализации`)
            const originalDBCollectionInTargetDir = await testDBController.find("collection")
            expect(originalDBCollectionInTargetDir).toHaveLength(2)
            
            // check original files in the disk folder
            expect(fs.pathExistsSync(newFilePath)).toBeTruthy()
            expect(fs.pathExistsSync(newVideoFile)).toBeTruthy()
            
            // FILES REMOVING
            await removingController.startRemovingPipeline()
            
            // check pathsArr config
            testDBController.DBRequest = DBRequests.directoriesList
            const {pathsArr: paths2} = await testDBController.findOne('configCollection')
            expect(paths2).toEqual(['tests', 'tests/testDirectory'])
            
            // check all files in DB collection
            testDBController.DBRequest = {}
            const DBCollection = await testDBController.find("collection")
            expect(DBCollection).toHaveLength(1)
            
            // check files in DB collection that are in the target directory
            testDBController.DBRequest = DBRequests.byFieldUsingStartsWith('filePath', '/tests/testDirectory/проверка локализации')
            const DBCollectionInTargetDir = await testDBController.find("collection")
            expect(DBCollectionInTargetDir).toHaveLength(0)
            
            // check files in the disk folder
            expect(fs.pathExistsSync(newFilePath)).toBeFalsy()
            expect(fs.pathExistsSync(newVideoFile)).toBeFalsy()
            expect(fs.pathExistsSync('tests/testDirectory/проверка локализации')).toBeFalsy()
            expect(fs.pathExistsSync('tests/testDirectory')).toBeTruthy()
        })
        test(`should send SUCCESS object`, async () => {
            await removingController.startRemovingPipeline()
            expect(res.send).toBeCalledWith({success: true, filePaths: ['tests', 'tests/testDirectory']})
        })
        test(`should send an Error if there is no such directory in pathsArr`, async () => {
            req.url = wrongUrl
            removingController = new removeDirController(res, req)
            await removingController.startRemovingPipeline()
            expect(res.send).toBeCalledWith({error: "can't find target directory"})
        })
    })
})
