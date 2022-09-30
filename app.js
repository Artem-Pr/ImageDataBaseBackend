const fs = require('fs-extra')
const {getMulterSettings} = require("./utils/multerSettings")
const {logger} = require("./utils/logger")
const {getParam} = require("./utils/common")
const {keywordsRequest} = require("./requests/keywordsRequest")
const {uploadItemRequest} = require("./requests/uploadItemRequest")
const {imageItemRequest} = require("./requests/imageItemRequest")
const {uploadRequest} = require("./requests/uploadRequest")
const {updateRequest} = require("./requests/updateRequest")
const {getFilesFromDB} = require("./requests/getPhotos")
const {pathRequest} = require("./requests/pathsRequest")
const {removeFilesItem} = require("./requests/removeFilesItem")
const {checkDirectory} = require("./requests/checkDirectory")
const {removeDirController} = require("./requests/removeDirectory")
const {matchingNumberOfFilesTest} = require("./requests/testRequests/matchingNumberOfFilesTest")
const {matchingVideoThumbnailsTest} = require('./requests/testRequests/matchingVideoThumbnailsTest')
// const {updateStringDateToDateFormat} = require('./utils/updateStringDateToDateFormat')
const {MongoClient} = require("mongodb")
const express = require('express')
const cors = require('cors')

// пакет для работы с exifTool
const exiftool = require('node-exiftool')
// пакет для получения пути к исполняемому файлу exifTool
const exiftoolBin = require('dist-exiftool')
// запускаем exifTool
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const app = express()

const tempFolder = 'temp'
const databaseFolder = '/app/dataBase' //docker mode
// const databaseFolder = 'dataBase' //local mode
const port = 5000
const mongoClient = new MongoClient("mongodb://mongo:27017/", { //docker mode
// const mongoClient = new MongoClient("mongodb://localhost:27017/", {  //local mode
    useUnifiedTopology: true,
    useNewUrlParser: true
})
let dbClient

const isDataBaseExist = fs.existsSync(databaseFolder)
if (!isDataBaseExist) {
    logger.error('Can not find main database folder')
    return
}


const upload = getMulterSettings(tempFolder)

app.use(cors())
// Todo: move all paths to constants
app.use('/images', express.static(__dirname + '/temp')) //docker mode
// app.use('/images', express.static(__dirname + '/' + tempFolder)) //local mode
app.use('/database', express.static(databaseFolder)) //docker mode
// app.use('/database', express.static(__dirname + '/' + databaseFolder)) //local mode
logger.info('static database', {message: databaseFolder + '/database'})

app.get("/keywords", (req, res) => {
    logger.http('GET-query', {message: '/keywords'})
    keywordsRequest(req, res, tempFolder)
})

app.get("/paths", (req, res) => {
    logger.http('GET-query', {message: '/paths'})
    pathRequest(req, res)
})

app.get("/check-directory", (req, res) => {
    logger.http('GET-query', {message: '/check-directory', data: getParam(req, 'directory')})
    checkDirectory(req, res)
})

app.post("/uploadItem",
    upload.single("filedata"),
    (req, res) => {
        logger.http('POST-query', {message: '/uploadItem', data: req.file})
        uploadItemRequest(req, res)
    }
)

app.use("/image-exif",
    express.json({extended: true})
)

app.post("/image-exif",
    (req, res) => {
        logger.http('POST-query', {message: '/image-exif', data: req.body})
        imageItemRequest(req, res, databaseFolder, exiftoolProcess)
    }
)

app.use("/upload",
    express.json({extended: true})
)

app.post("/upload",
    (req, res) => {
        logger.http('POST-query', {message: '/upload', data: req.body})
        uploadRequest(req, res, exiftoolProcess, databaseFolder)
    }
)

app.use("/update",
    express.json({extended: true})
)

app.put("/update",
    (req, res) => {
        logger.http('POST-query', {message: '/update', data: req.body})
        updateRequest(req, res, exiftoolProcess, databaseFolder)
    }
)

app.use("/filtered-photos",
    express.json({extended: true})
)

app.post("/filtered-photos",
    (req, res) => {
        logger.http('POST-query', {message: '/filtered-photos', data: req.body})
        getFilesFromDB(req, res, tempFolder, databaseFolder)
    }
)

app.delete("/photo/:id", (req, res) => {
    logger.http('DELETE-query', {message: '/photo/:id', data: req.params.id})
    removeFilesItem(req, res, databaseFolder)
})

app.delete("/directory", (req, res) => {
    logger.http('DELETE-query', {message: '/directory', data: getParam(req, 'name')})
    const removingController = new removeDirController(res, req, databaseFolder)
    removingController.startRemovingPipeline()
})

app.use("/test/matching-files",
    express.json({extended: true})
)

app.post("/test/matching-files", (req, res) => {
    logger.http('POST-query', {message: '/test/matching-files', data: req.body})
    matchingNumberOfFilesTest(req, res, databaseFolder)
})

app.use("/test/matching-videos",
    express.json({extended: true})
)

app.post("/test/matching-videos", (req, res) => {
    logger.http('POST-query', {message: '/test/matching-videos', data: req.body})
    matchingVideoThumbnailsTest(req, res, databaseFolder)
})

app.use((req, res, next) => {
    res.status(res.status || 500)
    res.json({
        status: res.status,
        message: res.message,
        stack: res.stack
    })
    next()
})

mongoClient.connect(function (err, client) {
    if (err) {
        logger.error('mongoClient.connect - oops!', {data: err})
        console.error(err)
        return
    }
    
    dbClient = client
    // app.locals.collection = client.db("IDB").collection("photos")
    // app.locals.configCollection = client.db("IDB").collection("config")
    app.locals.collection = client.db("IDBase").collection("photos")
    app.locals.configCollection = client.db("IDBase").collection("config")
    // app.locals.collection = client.db("dataBase").collection("photos")
    // app.locals.configCollection = client.db("dataBase").collection("config")
    // app.locals.collection = client.db("TestDB").collection("photos")
    // app.locals.configCollection = client.db("TestDB").collection("config")
    app.listen(port, function () {
        logger.info('Start listening on port', {message: port})
    })
    
    // включить, если нужно обновить даты коллекции со string на Date
    // updateStringDateToDateFormat({app, body: null})
})

// прослушиваем прерывание работы программы (ctrl-c)
process.on("SIGINT", () => {
    dbClient.close()
    process.exit()
    logger.info('MongoDb connection closed.')
})

module.exports = {app}
