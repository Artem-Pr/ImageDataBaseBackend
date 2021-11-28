const {copySync, mkdirpSync} = require('fs-extra')
const {logger} = require("../utils/logger")

const {MatchingNumberOfFilesTestController} = require("../requests/testRequests/matchingNumberOfFilesTest")
const fs = require("fs-extra");

const directoriesListFromDisk = [
    'emptyFolder',
    'video',
    'проверка локализации',
    'проверка локализации/photos'
]

const filesListFromDisk = [
    'image001-map.jpg',
    'video/YDXJ1442.mp4',
    'проверка локализации/photos/image001-map.jpg',
    'проверка локализации/photos/image002-map.jpg'
]

describe('matchingNumberOfFilesTestSpec', () => {
    describe('matchingNumberOfFilesTestController', () => {
        let req = {body: {pid: 111111}}
        let res = {send: null}
        const testController = new MatchingNumberOfFilesTestController(req, res, 'tests/testDirectory')
        beforeAll(() => {
            logger.verbose('beforeAll')
            mkdirpSync('tests/testDirectory/video')
            mkdirpSync('tests/testDirectory/emptyFolder')
            mkdirpSync('tests/testDirectory/проверка локализации/photos')
            copySync('tests/tempVideos/YDXJ1442.mp4', 'tests/testDirectory/video/YDXJ1442.mp4')
            copySync('tests/test-images/image001-map.jpg', 'tests/testDirectory/image001-map.jpg')
            copySync('tests/test-images/image001-map.jpg', 'tests/testDirectory/проверка локализации/photos/image001-map.jpg')
            copySync('tests/test-images/image002-map.jpg', 'tests/testDirectory/проверка локализации/photos/image002-map.jpg')
        })
    
        afterAll(() => {
            logger.verbose('afterAll')
            fs.removeSync('tests/testDirectory')
            fs.mkdirpSync('tests/testDirectory/проверка локализации')
        })
        
        describe('getFilesListFromRootDirectory:', () => {
            test('should create file list', async () => {
                await testController.getFilesListFromRootDirectory()
                expect(testController.directoriesListFromDisk).toEqual(directoriesListFromDisk)
                expect(testController.filesListFromDisk).toEqual(filesListFromDisk)
            })
        })
    })
})
