const fs = require('fs-extra')
const {getMulterSettings} = require("./utils/multerSettings")
const {logger} = require("./utils/logger")
const {getParam} = require("./utils/common")
const {keywordsRequest} = require("./requests/keywordsRequest")
const {uploadItemRequest} = require("./requests/uploadItemRequest")
const {imageItemRequest} = require("./requests/imageItemRequest")
const {uploadRequest} = require("./requests/uploadRequest")
const {updateRequest} = require("./requests/updateRequest")
const {getFilesFromDB} = require("./requests/getPhotos/getFilesFromDB")
const {pathRequest} = require("./requests/pathsRequest")
const {removeFilesItem} = require("./requests/removeFilesItem")
const {checkDirectory} = require("./requests/checkDirectory")
const {removeDirController} = require("./requests/removeDirectory")
const {matchingNumberOfFilesTest} = require("./requests/testRequests/matchingNumberOfFilesTest")
const {matchingVideoThumbnailsTest} = require('./requests/testRequests/matchingVideoThumbnailsTest')
const {getUnusedKeywordsRequest} = require('./requests/getUnusedKeywordsRequest')
const {removeKeywordRequest} = require('./requests/removeKeywordRequest')
// const {updateStringDateToDateFormat} = require('./utils/updateStringDateToDateFormat')

const {
    PORT,
    DATABASE_FOLDER_NAME,
    PREVIEWS_FOLDER_NAME,
    DATABASE_FOLDER,
    PREVIEWS_FOLDER,
    UPLOAD_IMAGES_TEMP_FOLDER,
    IMAGES_TEMP_FOLDER,
    MONGO_HOST_NAME,
    TEMP_FOLDER,
    UPLOAD_TEMP_FOLDER,
} = require('./constants')

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

const mongoClient = new MongoClient(`mongodb://${MONGO_HOST_NAME}:27017/`, {
    useUnifiedTopology: true,
    useNewUrlParser: true
})
let dbClient

const isDataBaseExist = fs.existsSync(DATABASE_FOLDER)
if (!isDataBaseExist) {
    logger.error('Can not find main database folder')
    return
}

const upload = getMulterSettings(UPLOAD_TEMP_FOLDER)

app.use(cors())
app.use('/' + IMAGES_TEMP_FOLDER, express.static(__dirname + '/' + TEMP_FOLDER))
app.use('/' + UPLOAD_IMAGES_TEMP_FOLDER, express.static(__dirname + '/' + UPLOAD_TEMP_FOLDER))
app.use('/' + DATABASE_FOLDER_NAME, express.static(DATABASE_FOLDER))
app.use('/' + PREVIEWS_FOLDER_NAME, express.static(PREVIEWS_FOLDER))
logger.info('static database', {message: DATABASE_FOLDER})

app.get("/keywords", (req, res) => {
    logger.http('GET-query', {message: '/keywords'})
    keywordsRequest(req, res)
})

app.get("/unused-keywords", (req, res) => {
    logger.http('GET-query', {message: '/unused-keywords'})
    void getUnusedKeywordsRequest(req, res)
})

app.delete("/keyword/:keyword", (req, res) => {
    logger.http('DELETE-query', {message: '/keyword/:keyword', data: req.params.keyword})
    void removeKeywordRequest(req, res)
})

app.get("/paths", (req, res) => {
    logger.http('GET-query', {message: '/paths'})
    pathRequest(req, res)
})

app.get("/check-directory", (req, res) => {
    logger.http('GET-query', {message: '/check-directory', data: getParam(req, 'directory')})
    void checkDirectory(req, res)
})

app.post("/uploadItem",
    upload.single("filedata"),
    (req, res) => {
        logger.http('POST-query', {message: '/uploadItem', data: req.file})
        void uploadItemRequest(req, res)
    }
)

app.use("/image-exif",
    express.json({extended: true})
)
app.post("/image-exif",
    (req, res) => {
        logger.http('POST-query', {message: '/image-exif', data: req.body})
        void imageItemRequest(req, res, exiftoolProcess)
    }
)

app.use("/upload",
    express.json({extended: true})
)
app.post("/upload",
    (req, res) => {
        logger.http('POST-query', {message: '/upload', data: req.body})
        void uploadRequest(req, res, exiftoolProcess)
    }
)

app.use("/update",
    express.json({extended: true})
)
app.put("/update",
    (req, res) => {
        logger.http('POST-query', {message: '/update', data: req.body})
        void updateRequest(req, res, exiftoolProcess)
    }
)

app.use("/filtered-photos",
    express.json({extended: true})
)
app.post("/filtered-photos",
    (req, res) => {
        logger.http('POST-query', {message: '/filtered-photos', data: req.body})
        void getFilesFromDB(req, res)
    }
)

app.delete("/photo/:id", (req, res) => {
    logger.http('DELETE-query', {message: '/photo/:id', data: req.params.id})
    void removeFilesItem(req, res)
})

app.delete("/directory", (req, res) => {
    logger.http('DELETE-query', {message: '/directory', data: getParam(req, 'name')})
    const removingController = new removeDirController(res, req, true)
    void removingController.startRemovingPipeline()
})

app.use("/test/matching-files",
    express.json({extended: true})
)
app.post("/test/matching-files", (req, res) => {
    logger.http('POST-query', {message: '/test/matching-files', data: req.body})
    void matchingNumberOfFilesTest(req, res)
})

app.use("/test/matching-videos",
    express.json({extended: true})
)
app.post("/test/matching-videos", (req, res) => {
    logger.http('POST-query', {message: '/test/matching-videos', data: req.body})
    void matchingVideoThumbnailsTest(req, res)
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
    app.listen(PORT, function () {
        logger.info('Start listening on port', {message: PORT})
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
