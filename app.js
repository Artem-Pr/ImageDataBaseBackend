const fs = require('fs-extra')
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

const tempFolder = 'temp'
// const databaseFolder = '../../../../../../../Volumes/Transcend V/dataBase'
const databaseFolder = '../../../../../../../Volumes/Transcend V/TestDB'
const port = 5000
const mongoClient = new MongoClient("mongodb://localhost:27017/", {
	useUnifiedTopology: true,
	useNewUrlParser: true
})
let dbClient

const isDataBaseExist = fs.existsSync(databaseFolder)
if (!isDataBaseExist) {
	console.log('Can not find main database folder')
	return
}


const upload = getMulterSettings(tempFolder)

app.use(cors())
app.use('/images', express.static(__dirname + '/temp'))
app.use('/database', express.static(databaseFolder))
console.log('static database', databaseFolder + '/database')

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

app.use("/image-exif",
	express.json({extended: true})
)

app.post("/image-exif",
	(req, res) => imageItemRequest(req, res, databaseFolder, exiftoolProcess)
)

app.use("/upload",
	express.json({extended: true})
)

app.post("/upload",
	(req, res) =>
		uploadRequest(req, res, exiftoolProcess, databaseFolder)
)

app.use("/update",
	express.json({extended: true})
)

app.put("/update",
	(req, res) =>
		updateRequest(req, res, exiftoolProcess, databaseFolder)
)

app.use("/filtered-photos",
	express.json({extended: true})
)

app.post("/filtered-photos",
	(req, res) => getFilesFromDB(req, res, tempFolder, databaseFolder)
)

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
	if (err) return console.log('mongoClient.connect - oops!', err)
	dbClient = client
	// app.locals.collection = client.db("IDB").collection("photos")
	// app.locals.configCollection = client.db("IDB").collection("config")
	// app.locals.collection = client.db("IDBase").collection("photos")
	// app.locals.configCollection = client.db("IDBase").collection("config")
	// app.locals.collection = client.db("dataBase").collection("photos")
	// app.locals.configCollection = client.db("dataBase").collection("config")
	app.locals.collection = client.db("TestDB").collection("photos")
	app.locals.configCollection = client.db("TestDB").collection("config")
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
