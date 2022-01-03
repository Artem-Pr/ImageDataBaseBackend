const fs = require('fs-extra')
const ObjectId = require('mongodb').ObjectID
const {removeFilesItem} = require("../requests/removeFilesItem")
const {deepCopy} = require("../utils/common")
const {MongoClient} = require('mongodb')
const moment = require('moment');


const originalDirectory = 'tests/test-images/'
const originalVideoDirectory = 'tests/tempVideos/'
const directory = 'tests/testDirectory/проверка локализации/'
const file1 = 'image001-map.jpg'
const file2 = 'image002-map.jpg'
const video = 'YDXJ1442.mp4'
const videoThumbnail = 'YDXJ1442-thumbnail-1000x562-0001.png'
const originalData = [{
    _id: ObjectId("6151f3aa86c6ca71bc443a9a"),
    originalName: file1,
    mimetype: 'image/jpeg',
    size: 2000000,
    megapixels: 8,
    imageSize: '3000x3000',
    keywords: ['map', 'forest', 'estonia'],
    changeDate: '2011.11.11',
    originalDate: moment.utc('2010.10.10', 'YYYY.MM.DD').toDate(),
    filePath: directory + file1,
    preview: '',
}, {
    _id: ObjectId("5fef4856497f3af84699e77e"),
    originalName: file2,
    mimetype: 'image/jpeg',
    size: 1000000,
    megapixels: 10,
    imageSize: '2000x2000',
    keywords: ['bike', 'Olga', 'estonia'],
    changeDate: '2011.12.12',
    originalDate: moment.utc('2010.01.01', 'YYYY.MM.DD').toDate(),
    filePath: directory + file2,
    preview: '',
}, {
    _id: ObjectId("60fd9b60e52cbf5832df4bb7"),
    originalName: video,
    mimetype: 'video/mp4',
    size: 2000000,
    megapixels: 8,
    imageSize: '3000x3000',
    keywords: null,
    changeDate: '2011.11.11',
    originalDate: moment.utc('2010.10.10', 'YYYY.MM.DD').toDate(),
    filePath: directory + video,
    preview: directory + videoThumbnail,
}]

describe('removeFilesItem: ', () => {
    let initialRequest = {
        app: {locals: {collection: null}},
        params: {id: 'some-number'}
    }
    let res = {send: jest.fn(value => value)}
    
    let testCollections
    let connection
    let db
    let req
    
    beforeAll(async () => {
        console.log('start beforeAll')
        connection = await MongoClient.connect("mongodb://localhost:27017/", {
            useUnifiedTopology: true,
            useNewUrlParser: true
        })
        db = await connection.db('IDB')
        testCollections = db.collection('test')
    })
    
    beforeEach(async () => {
        console.log('start beforeEach Global')
        
        req = deepCopy(initialRequest)
        try {
            await testCollections.insertMany(originalData)
            console.log("testCollections is created")
        } catch (err) {
            console.log("testCollections insert error", err)
        }
        req.app.locals.collection = testCollections
        
        fs.copySync(originalDirectory + file1, directory + file1)
        fs.copySync(originalDirectory + file2, directory + file2)
        fs.copySync(originalVideoDirectory + video, directory + video)
        fs.copySync(originalVideoDirectory + videoThumbnail, directory + videoThumbnail)
    })
    
    afterEach(async () => {
        console.log('start afterEach Global')
        // Collection cleaning
        await req.app.locals.collection.deleteMany({})
        
        fs.removeSync(directory + file1)
        fs.removeSync(directory + file2)
        fs.removeSync(directory + video)
        fs.removeSync(directory + videoThumbnail)
    })
    
    afterAll(async () => {
        console.log('start afterAll')
        await connection.close()
    })
    
    describe('Remove photo: ', () => {
        beforeEach(() => {
            console.log('start beforeEach')
            req.params = {id: "6151f3aa86c6ca71bc443a9a"}
        })
        test('Should send an Error message if req has no params', async () => {
            req.params = null
            const response = await removeFilesItem(req, res, '')
            expect(response).toBeNull()
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith({error: "Remove files item - missing id"})
        })
        test('Should send an Error message if there is no matches in DB', async () => {
            req.params = {id: "610dac5212af612e5f1bd94c"}
            const response = await removeFilesItem(req, res, '')
            expect(response).toBeNull()
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith({error: "Remove files item - file not found in DB"})
        })
        test('Should send an Error message if there is no target file in the directory', async () => {
            fs.removeSync(directory + file1)
            const response = await removeFilesItem(req, res, '')
            expect(response).toBeNull()
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith({error: 'Remove files item - file not found in Directory'})
        })
        test('Should remove target file from directory', async () => {
            await removeFilesItem(req, res, '')
            expect(fs.existsSync(directory + file1)).toBeFalsy()
            expect(fs.existsSync(directory + file2)).toBeTruthy()
        })
        test('Should remove target file from DB', async () => {
            await removeFilesItem(req, res, '')
            const response1 = await req.app.locals.collection.findOne({_id: ObjectId('6151f3aa86c6ca71bc443a9a')})
            const response2 = await req.app.locals.collection.findOne({_id: ObjectId('5fef4856497f3af84699e77e')})
            expect(response1).toBeNull()
            expect(response2).toBeDefined()
            expect(response2.filePath).toBe(directory + file2)
        })
    })
    
    describe('Remove video: ', () => {
        beforeEach(() => {
            console.log('start beforeEach')
            req.params = {id: "60fd9b60e52cbf5832df4bb7"}
        })
        test('Should send an Error message if there is no target file in the directory', async () => {
            fs.removeSync(directory + video)
            const response = await removeFilesItem(req, res, '')
            expect(response).toBeNull()
            expect(res.send).toBeCalled()
            expect(res.send).lastReturnedWith({error: 'Remove files item - file not found in Directory'})
        })
        test('Should remove target file from directory', async () => {
            await removeFilesItem(req, res, '')
            expect(fs.existsSync(directory + video)).toBeFalsy()
            expect(fs.existsSync(directory + file1)).toBeTruthy()
            expect(fs.existsSync(directory + file2)).toBeTruthy()
        })
        test('Should remove thumbnail file from directory', async () => {
            await removeFilesItem(req, res, '')
            expect(fs.existsSync(directory + video)).toBeFalsy()
            expect(fs.existsSync(directory + videoThumbnail)).toBeFalsy()
            expect(fs.existsSync(directory + file1)).toBeTruthy()
            expect(fs.existsSync(directory + file2)).toBeTruthy()
        })
        test('Should remove target file from DB', async () => {
            await removeFilesItem(req, res, '')
            const resVideo = await req.app.locals.collection.findOne({_id: ObjectId('60fd9b60e52cbf5832df4bb7')})
            const resFile1 = await req.app.locals.collection.findOne({_id: ObjectId('6151f3aa86c6ca71bc443a9a')})
            const resFile2 = await req.app.locals.collection.findOne({_id: ObjectId('5fef4856497f3af84699e77e')})
            expect(resVideo).toBeNull()
            expect(resFile1).toBeDefined()
            expect(resFile2).toBeDefined()
            expect(resFile1.filePath).toBe(directory + file1)
            expect(resFile2.filePath).toBe(directory + file2)
        })
    })
})
