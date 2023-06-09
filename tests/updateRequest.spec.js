const fs = require('fs-extra')
const {MongoClient} = require('mongodb')
const {logger} = require("../utils/logger")
const ObjectId = require('mongodb').ObjectID
const exiftool = require('node-exiftool')
const exiftoolBin = require('dist-exiftool')
const {getExifFromPhoto} = require("../utils/exifTool")
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const {
    originalData,
    updateFiledata,
    videoOriginalFileData,
    videoUpdatedData,
    updatedFileDateForReturningValues,
    pushExifFiledata,
    originalPathsList,
    updateFileDataWithFilePath,
    shortPathArr,
} = require("./Data")
const {deepCopy, renameFile} = require("../utils/common")
const {
    renameFileIfNeeded,
    isDifferentNames,
    findObjects,
    updateDatabase,
    updateFile,
    updateRequest,
    moveFile,
    addNewFilePath,
} = require("../requests/updateRequest/updateRequest")
const {backupTestFiles, recoverTestFiles} = require("./helpers")

const updatedFileNames = [
    'tests/test-images/123.jpg',
    'tests/test-images/bom-bom.jpg'
]

describe('updateRequest: ', () => {
    let req = {
        app: {locals: {collection: null}},
        body: null
    }
    let res = {send: null}
    
    let testCollections
    let testConfigCollection
    let connection
    let db
    
    beforeAll(async () => {
        logger.verbose('start beforeAll')
        connection = await MongoClient.connect("mongodb://localhost:27017/", {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })
        db = await connection.db('IDB')
        testCollections = db.collection('test')
        testConfigCollection = db.collection("testConfig")
    })
    
    beforeEach(async () => {
        logger.verbose('start beforeEach')
        req.body = deepCopy(updateFiledata)
        req.app.locals.configCollection = testConfigCollection
        req.app.locals.collection = testCollections
        
        try {
            await req.app.locals.collection.insertMany(originalData)
            logger.verbose("testCollections is created")
        } catch (err) {
            logger.verbose("testCollections insert error", err)
        }
        try {
            await req.app.locals.configCollection.insertOne({name: "paths", pathsArr: originalPathsList})
            logger.verbose("configCollection is created")
        } catch (err) {
            logger.verbose("configCollection insert error", err)
        }
        backupTestFiles()
    })
    
    afterEach(async () => {
        logger.verbose('start afterEach')
        await req.app.locals.collection?.deleteMany({})
        await req.app.locals.configCollection?.deleteMany({})
        recoverTestFiles()
    })
    
    afterAll(async () => {
        logger.verbose('start afterAll')
        await connection.close()
    })
    
    describe('updateFile: ', () => {
        test('should return correct response.value from database', async () => {
            const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.20\"}"
            const id = "5fef484b497f3af84699e88c"
            const updatedFields = Object.assign(updateFiledata[1].updatedFields)
            const filedata = Object.assign(originalData[0])
            const collection = req.app.locals.collection
            const response = await updateFile(id, updatedFields, filedata, collection)
            await expect(JSON.stringify(response)).toBe(correctResponse)
        })
        test('should return correct response.value from database if send new filePath', async () => {
            const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/testDirectory/проверка локализации/123.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.24\"}"
            const id = "5fef484b497f3af84699e88c"
            const updatedFields = Object.assign(updateFileDataWithFilePath[0].updatedFields)
            const filedata = Object.assign(originalData[0])
            const collection = req.app.locals.collection
            const response = await updateFile(id, updatedFields, filedata, collection)
            await expect(JSON.stringify(response)).toBe(correctResponse)
        })
        test('should return correct response.value from database if send ONLY filePath', async () => {
            const correctResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"image001-map.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"map\",\"forest\",\"estonia\"],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/testDirectory/проверка локализации/image001-map.jpg\",\"preview\":\"\",\"originalDate\":\"2010.10.10\"}"
            const id = "5fef484b497f3af84699e88c"
            const updatedFields = Object.assign(updateFileDataWithFilePath[0].updatedFields)
            const currentUploadingFields = {filePath: updatedFields.filePath}
            const filedata = Object.assign(originalData[0])
            const collection = req.app.locals.collection
            const response = await updateFile(id, currentUploadingFields, filedata, collection)
            await expect(JSON.stringify(response)).toBe(correctResponse)
        })
        test('should return correct preview from database if send new originalName', async () => {
            try {
                await testCollections.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            
            const correctResponse = "{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/tempVideos/bom-bom.mp4\",\"preview\":\"tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png\",\"originalDate\":\"2021.07.26\"}"
            const id = "60fd9b60e52cbf5832df4bb7"
            const updatedFields = {...videoUpdatedData[0].updatedFields}
            const filedata = {...videoOriginalFileData[0]}
            
            const response = await updateFile(id, updatedFields, filedata, testCollections)
            await expect(JSON.stringify(response)).toBe(correctResponse)
        })
    })
    describe('updateDatabase: ', () => {
        test('should return correct Array of updated data', async () => {
            const firstResponse = "{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.24\"}"
            const secondResponse = "{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.20\"}"
            const filedata = req.body
            const collection = req.app.locals.collection
            const fileDataArr = deepCopy(originalData)
            const response = await updateDatabase(filedata, fileDataArr, collection)
            await expect(JSON.stringify(response[0])).toBe(firstResponse)
            await expect(JSON.stringify(response[1])).toBe(secondResponse)
        })
        test('should correctly update video file', async () => {
            try {
                await testCollections.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            req.app.locals.collection = testCollections
            
            const updatedFiles = deepCopy(videoUpdatedData)
            const videoFormatResponse = "{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/tempVideos/bom-bom.mp4\",\"preview\":\"tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png\",\"originalDate\":\"2021.07.26\"}"
            const collection = req.app.locals.collection
            const response = await updateDatabase(updatedFiles, videoOriginalFileData, collection)
            await expect(JSON.stringify(response[0])).toBe(videoFormatResponse)
        })
    })
    describe('findObject: ', () => {
        test('should return found objects from DB', async () => {
            const firstResponse = JSON.stringify(originalData[0])
            const secondResponse = JSON.stringify(originalData[1])
            
            const idsArr = originalData.map(item => item._id)
            const collection = req.app.locals.collection
            const response = await findObjects(idsArr, collection)
            
            await expect(JSON.stringify(response[0])).toBe(firstResponse)
            await expect(JSON.stringify(response[1])).toBe(secondResponse)
        })
        test('should throw Error if cant find object in DB', async () => {
            const id1 = ObjectId("5fef484b497f3af84699e77b")
            const id2 = ObjectId("5fef484b497f3af84699e77c")
            const idsArr = [id1, id2]
            const collection = req.app.locals.collection
            try {
                await findObjects(idsArr, collection)
            } catch (error) {
                await expect(error.message).toBe('OOPS! ERROR: "findObjects" can\'t find DB object')
            }
        })
    })
    describe('isDifferentNames: ', () => {
        test('should return ERROR if originalName is duplicated', () => {
            const fileDataItem = req.body[0]
            const duplicatedFileDataItem = {
                ...fileDataItem,
                updatedFields: {originalName: originalData[0].originalName}
            }
            try {
                isDifferentNames(originalData[0], duplicatedFileDataItem)
            } catch (error) {
                expect(error.message).toBe('ERROR - isDifferentNames: duplicated originalName')
            }
        })
        test('should return "true" if originalNames are different', () => {
            expect(isDifferentNames(originalData[0], updateFiledata[0])).toBeTruthy()
        })
    })
    describe('renameFileIfNeeded: ', () => {
        test('should rename file if updateFiledata has originalName field', async () => {
            const updatedFileName = 'tests/test-images/123.jpg'
            const {newNamePath, newPreviewPath} = await renameFileIfNeeded(originalData[0], updateFiledata[0], '')
            expect(newNamePath).toBe(updatedFileName)
            expect(newPreviewPath).toBe('')
            
            await renameFile(updatedFileName, originalData[0].filePath)
            expect(fs.existsSync(originalData[0].filePath)).toBe(true)
        })
        test('should return "false" if updateFiledata does not has originalName field', async () => {
            const updateFiledataItem = req.body[1]
            delete updateFiledataItem.updatedFields.originalName
            const response = await renameFileIfNeeded(originalData[0], updateFiledataItem, '')
            expect(response).toBeFalsy()
        })
        test('should return "false" if updateFiledata has filePath', async () => {
            const response = await renameFileIfNeeded(originalData[0], deepCopy(updateFileDataWithFilePath[0]), '')
            expect(response).toBeFalsy()
        })
        test('should return ERROR if originalName is duplicated', async () => {
            const fileDataItem = req.body[0]
            const duplicatedFileDataItem = {
                ...fileDataItem,
                updatedFields: {originalName: originalData[0].originalName}
            }
            try {
                await renameFileIfNeeded(originalData[0], duplicatedFileDataItem)
            } catch (error) {
                expect(error.message).toBe('ERROR - isDifferentNames: duplicated originalName')
            }
        })
        test('should correctly rename video file and return renamed file and thumbnail', async () => {
            const resultNamePath = 'tests/tempVideos/bom-bom.mp4'
            const resultPreviewPath = 'tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png'
            const {
                newNamePath,
                newPreviewPath
            } = await renameFileIfNeeded(videoOriginalFileData[0], deepCopy(videoUpdatedData)[0])
            
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
        })
        test('should move file', async () => {
            const originalName = 'image001-map.jpg'
            const originalFilePath = 'tests/test-images/image001-map.jpg'
            const destWithoutName = 'tests/testDirectory/проверка локализации'
            const newFullPath = destWithoutName + '/' + originalName
            
            try {
                await moveFile(originalFilePath, destWithoutName, originalName, '')
            } catch (error) {
                logger.verbose(error)
            }
            
            expect(fs.existsSync(newFullPath)).toBeTruthy()
            expect(fs.existsSync(originalFilePath)).toBeFalsy()
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
                logger.verbose(error)
            }
            
            expect(fs.existsSync(newFullPath)).toBeTruthy()
            expect(fs.existsSync(originalFilePath)).toBeFalsy()
        })
    })
    describe('addNewFilePath: ', () => {
        const testFilePath = 'tests/testDirectory/проверка локализации'
        const existingFilePath = 'природа/корпоратив'
        let updatedFields = []
        let updatedFieldsWithFilePath = []
        let updatedFieldsWithExistingFilePath = []
        let configCollection
        
        beforeEach(async () => {
            logger.verbose('addNewFilePath: start beforeEach')
            configCollection = db.collection('testConfig')
            req.app.locals.configCollection = configCollection
            await configCollection.insertOne({name: "paths", pathsArr: originalPathsList})
            
            updatedFields = deepCopy(updateFiledata.map(item => item.updatedFields))
            updatedFieldsWithFilePath = deepCopy(updateFileDataWithFilePath
                .map((item, i) => ({...item.updatedFields, filePath: `${testFilePath}${i}`})))
            updatedFieldsWithExistingFilePath = deepCopy(updateFiledata
                .map(item => ({...item.updatedFields, filePath: existingFilePath})))
        })
        
        afterEach(async () => {
            logger.verbose('addNewFilePath: start afterEach')
            await configCollection.deleteMany({})
        })
        
        afterAll(async () => {
            logger.verbose('addNewFilePath: start afterAll')
        })
        
        test('should return Error if collection is broken', async () => {
            req.app.locals.configCollection = null
            try {
                await addNewFilePath(req, updatedFieldsWithFilePath)
            } catch (error) {
                expect(error.message).toBe(`DBController - findOne: Cannot read property 'findOne' of null`)
            }
        })
        test("should return an empty array if updateFiledata doesn't have filePath fields", async () => {
            const response = await addNewFilePath(req, updatedFields)
            expect(response).toHaveLength(0)
        })
        test('should return an empty array if new filePaths exist in pathsArr', async () => {
            const response = await addNewFilePath(req, updatedFieldsWithExistingFilePath)
            expect(response).toHaveLength(0)
        })
        test('should return all filePaths array after adding new ones', async () => {
            const expected = [
                'tests',
                'tests/testDirectory',
                'tests/testDirectory/проверка локализации0',
                'tests/testDirectory/проверка локализации1'
            ]
            
            expect(originalPathsList).toHaveLength(16)
            const response = await addNewFilePath(req, updatedFieldsWithFilePath)
            expect(response).toHaveLength(20)
            expect(response).toEqual(expect.arrayContaining(expected))
        })
    })
    describe('updateRequest: ', () => {
        let updatedFileDateForReturning
        let exifFiledata
        let keywordsArrForReturning
        let pathsArr
        
        beforeEach(async () => {
            logger.verbose('updateRequest: start beforeEach')
            updatedFileDateForReturning = deepCopy(updatedFileDateForReturningValues)
            exifFiledata = deepCopy(pushExifFiledata)
            keywordsArrForReturning = updatedFileDateForReturningValues.map(dataItem => dataItem.updatedFields.keywords)
            pathsArr = originalData.map(dataItem => dataItem.filePath)
        })
        
        afterEach(async () => {
            logger.verbose('updateRequest: start afterEach')
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
        })
        test('should rename file if updateFiledata has originalName field', async () => {
            const updatedFileName1 = 'tests/test-images/123.jpg'
            const updatedFileName2 = 'tests/test-images/bom-bom.jpg'
            res.send = jest.fn(value => value)
            await updateRequest(req, res, exiftoolProcess)
            expect(fs.existsSync(updatedFileName1)).toBe(true)
            expect(fs.existsSync(updatedFileName2)).toBe(true)
        })
        test('should rewrite exif', async () => {
            const response = {send: null}
            const request = {
                app: {locals: {collection: null}},
                body: null
            }
            response.send = jest.fn(value => value)
            request.body = deepCopy(updateFiledata)
            request.app.locals.collection = testCollections
            request.app.locals.configCollection = testConfigCollection
            
            
            const originalExif = await getExifFromPhoto(pathsArr, shortPathArr, exiftoolProcess)
            expect(originalExif[shortPathArr[1]].Keywords).toEqual(["bike", "Olga", "estonia"])
            expect(originalExif[shortPathArr[1]].DateTimeOriginal).toBe('2019:06:24 12:00:00')
            
            await updateRequest(request, response, exiftoolProcess)
            
            const updatedExifObj = await getExifFromPhoto(updatedFileNames, shortPathArr, exiftoolProcess)
            expect(updatedExifObj[shortPathArr[0]].Keywords).toBeUndefined()
            expect(updatedExifObj[shortPathArr[1]].Keywords).toBe('green')
            expect(updatedExifObj[shortPathArr[0]].DateTimeOriginal).toBe('2019:06:24 12:00:00')
            expect(updatedExifObj[shortPathArr[1]].DateTimeOriginal).toBe('2019:06:20 12:00:00')
        })
        test('should return correct response.value from updateRequest', async () => {
            const correctResponse = "{\"files\":[{\"_id\":\"5fef484b497f3af84699e88c\",\"originalName\":\"123.jpg\",\"mimetype\":\"image/jpeg\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/test-images/123.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.24\",\"tempPath\":\"tests/test-images/123.jpg\",\"originalPath\":\"http://localhost:5000/tests/test-images/123.jpg\"},{\"_id\":\"5fef4856497f3af84699e77e\",\"originalName\":\"bom-bom.jpg\",\"mimetype\":\"image/jpeg\",\"size\":1000000,\"megapixels\":10,\"imageSize\":\"2000x2000\",\"keywords\":[\"green\"],\"changeDate\":\"2011.12.12\",\"filePath\":\"tests/test-images/bom-bom.jpg\",\"preview\":\"\",\"originalDate\":\"2019.06.20\",\"tempPath\":\"tests/test-images/bom-bom.jpg\",\"originalPath\":\"http://localhost:5000/tests/test-images/bom-bom.jpg\"},{\"_id\":\"60fd9b60e52cbf5832df4bb7\",\"originalName\":\"bom-bom.mp4\",\"mimetype\":\"video/mp4\",\"size\":2000000,\"megapixels\":8,\"imageSize\":\"3000x3000\",\"keywords\":[\"green\",\"песня про озеро\"],\"changeDate\":\"2011.11.11\",\"filePath\":\"tests/testDirectory/проверка локализации/bom-bom.mp4\",\"preview\":\"tests/testDirectory/проверка локализации/bom-bom-thumbnail-1000x562-0001.png\",\"originalDate\":\"2021.07.26\",\"tempPath\":\"tests/testDirectory/проверка локализации/bom-bom.mp4\",\"originalPath\":\"http://localhost:5000/tests/testDirectory/проверка локализации/bom-bom.mp4\"}],\"newFilePath\":[\"bom\",\"bom/Банско\",\"bom/Оля\",\"bom/озеро\",\"nature\",\"nature/вода\",\"tests\",\"tests/test-images\",\"tests/test-images/photo\",\"tests/testDirectory\",\"tests/testDirectory/проверка локализации\",\"природа\",\"природа/активный отдых\",\"природа/активный отдых/video\",\"природа/активный отдых/эстония\",\"природа/видео\",\"природа/видео/уточки\",\"природа/корпоратив\",\"пустая папка\"]}"
            
            res.send = jest.fn(value => JSON.stringify(value))
            req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
            req.body[2].updatedFields.filePath = 'tests/testDirectory/проверка локализации'
            try {
                await req.app.locals.collection.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            
            await updateRequest(req, res, exiftoolProcess)
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith(correctResponse)
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
        })
        test('should recover preview if there is rename Error', async () => {
            req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
            res.send = jest.fn(value => value)
            const originalFilePath = 'tests/tempVideos/YDXJ1442.mp4'
            const originalPreviewPath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
            const newPreviewPath = 'tests/tempVideos/bom-bom-thumbnail-1000x562-0001.png'
            
            try {
                await testCollections.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            
            fs.copySync(originalPreviewPath, newPreviewPath)
            await updateRequest(req, res, exiftoolProcess)
            
            expect(fs.existsSync(originalFilePath)).toBeTruthy()
            expect(fs.existsSync(originalPreviewPath)).toBeTruthy()
        })
        test('should recover preview if there is fs.move Error', async () => {
            const newFilePath = 'tests/testDirectory/проверка локализации'
            req.body = [...deepCopy(updateFiledata), ...deepCopy(videoUpdatedData)]
            req.body[2].updatedFields.filePath = newFilePath
            req.body[2].updatedFields.originalName = undefined
            res.send = jest.fn(value => value)
            const originalPreviewPath = 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png'
            const newPreviewPath = `${newFilePath}/YDXJ1442-thumbnail-1000x562-0001.png`
            
            try {
                await testCollections.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            
            fs.copySync(originalPreviewPath, newPreviewPath)
            await updateRequest(req, res, exiftoolProcess)
            
            expect(fs.existsSync(originalPreviewPath)).toBeTruthy()
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
            
            try {
                await testCollections.insertMany(videoOriginalFileData)
                logger.verbose("testCollections is created")
            } catch (err) {
                logger.verbose("testCollections insert error", err)
            }
            
            fs.copySync(originalPreviewPath, newPreviewPath)
            await updateRequest(req, res, exiftoolProcess)
            
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith(correctResponse)
        })
    })
})
