import {getMulterSettings} from "./utils/multerSettings";
import {keywordsRequest} from "./requests/keywordsRequest";
import {uploadItemRequest} from "./requests/uploadItemRequest";
import {imageItemRequest} from "./requests/imageItemRequest";
import {uploadRequest} from "./requests/uploadRequest";
import {mongoClient} from "./utils/mongoClient";
import express from 'express'
import cors from 'cors'

// пакет для работы с exifTool
import exiftool from 'node-exiftool'
// пакет для получения пути к исполняемому файлу exifTool
import exiftoolBin from 'dist-exiftool'
// запускаем exifTool
const exiftoolProcess = new exiftool.ExiftoolProcess(exiftoolBin)
const app = express();

const configPath = 'config.json'
const tempFolder = 'temp'
const port = 5000;
const DBClient = mongoClient

const upload = getMulterSettings(tempFolder)

app.use(cors());
app.use('/images', express.static(__dirname + '/temp'));

app.get("/keywords",
	(req, res) => keywordsRequest(res, tempFolder, configPath)
)

app.post("/uploadItem",
	upload.single("filedata"),
	(req, res) => uploadItemRequest(req, res)
)

app.get("/image-exif",
	(req, res) => imageItemRequest(req, res, exiftoolProcess)
)

app.use("/upload", express.json({extended: true}))

app.post("/upload",
	(req, res) =>
		uploadRequest(req, res, exiftoolProcess, configPath, DBClient)
)

app.use((error, req, res, next) => {
	res.status(error.status || 500)
	res.json({
		status: error.status,
		message: error.message,
		stack: error.stack
	})
})

const server = app.listen(port, function () {
	console.log("Start listening on port " + port);
});

process.on('SIGTERM', () => {
	console.info('SIGTERM signal received.');
	console.log('Closing http server.');
	server.close(() => {
		console.log('Http server closed.');
		// boolean means [force], see in mongoose doc
		mongoose.connection.close(false, () => {
			console.log('MongoDb connection closed.');
			process.exit(0);
		});
	});
});
