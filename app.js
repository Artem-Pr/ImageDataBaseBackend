const {getMulterSettings} = require("./utils/multerSettings")
const {keywordsRequest} = require("./requests/keywordsRequest")
const {uploadItemRequest} = require("./requests/uploadItemRequest")
const {imageItemRequest} = require("./requests/imageItemRequest")
const {uploadRequest} = require("./requests/uploadRequest")
const {updateRequest} = require("./requests/updateRequest")
const {getFilesFromDB} = require("./requests/getPhotos")
const {pathRequest} = require("./requests/pathsRequest")
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

const configPath = 'config.json'
const tempFolder = 'temp'
const databaseFolder = 'database'
const port = 5000
const mongoClient = new MongoClient("mongodb://localhost:27017/", {
	useUnifiedTopology: true,
	useNewUrlParser: true
})
let dbClient

const upload = getMulterSettings(tempFolder)

app.use(cors());
app.use('/images', express.static(__dirname + '/temp'));
app.use('/database', express.static(__dirname + '/database'));

app.get("/keywords",
	(req, res) => keywordsRequest(req, res, tempFolder)
)

app.get("/paths",
	(req, res) => pathRequest(req, res)
)

app.post("/uploadItem",
	upload.single("filedata"),
	(req, res) => uploadItemRequest(req, res)
)

app.get("/image-exif",
	(req, res) => imageItemRequest(req, res, exiftoolProcess)
)

app.use("/upload",
	express.json({extended: true})
)

app.post("/upload",
	(req, res) =>
		uploadRequest(req, res, exiftoolProcess, configPath, databaseFolder)
)

app.use("/update",
	express.json({extended: true})
)

app.put("/update",
	(req, res) =>
		updateRequest(req, res, exiftoolProcess, configPath, databaseFolder)
)

app.get("/filtered-photos",
	(req, res) => getFilesFromDB(req, res, tempFolder, configPath)
)

app.use((error, req, res, next) => {
	res.status(error.status || 500)
	res.json({
		status: error.status,
		message: error.message,
		stack: error.stack
	})
})

mongoClient.connect(function (err, client) {
	if (err) return console.log('mongoClient.connect - oops!', err)
	dbClient = client
	app.locals.collection = client.db("IDB").collection("photos")
	app.locals.configCollection = client.db("IDB").collection("config")
	app.listen(port, function () {
		console.log("Start listening on port " + port)
	})
})

// прослушиваем прерывание работы программы (ctrl-c)
process.on("SIGINT", () => {
	dbClient.close()
	process.exit()
	console.log('MongoDb connection closed.')
})

module.exports = {app}
