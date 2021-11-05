const fs = require('fs-extra')

const backupTestFiles = () => {
    fs.copySync('tests/tempVideos/YDXJ1442.mp4', 'tests/temp-1234/YDXJ1442.mp4')
    fs.copySync('tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png', 'tests/temp-1234/YDXJ1442-thumbnail-1000x562-0001.png')
    fs.copySync('tests/test-images/image001-map.jpg', 'tests/temp-1234/image001-map.jpg')
    fs.copySync('tests/test-images/image002-map.jpg', 'tests/temp-1234/image002-map.jpg')
}

const recoverTestFiles = () => {
    fs.removeSync('tests/tempVideos')
    fs.removeSync('tests/test-images')
    fs.removeSync('tests/testDirectory')
    fs.copySync('tests/temp-1234/YDXJ1442.mp4', 'tests/tempVideos/YDXJ1442.mp4')
    fs.copySync('tests/temp-1234/YDXJ1442-thumbnail-1000x562-0001.png', 'tests/tempVideos/YDXJ1442-thumbnail-1000x562-0001.png')
    fs.copySync('tests/temp-1234/image001-map.jpg', 'tests/test-images/image001-map.jpg')
    fs.copySync('tests/temp-1234/image002-map.jpg', 'tests/test-images/image002-map.jpg')
    fs.mkdirpSync('tests/testDirectory/проверка локализации')
    fs.removeSync('tests/temp-1234')
}

module.exports = {backupTestFiles, recoverTestFiles}
