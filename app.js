const express = require("express");
const createError = require('http-errors')
const path = require("path");
const multer = require("multer");
// var upload = multer({ dest: "uploads/" });
// const bodyParser = require("body-parser");
// const fileUpload = require("express-fileupload");
let fs = require('fs-extra');
// var mongo = require("mongodb");
const MongoClient = require("mongodb").MongoClient;
// var mongoose = require("mongoose");
// var Grid = require("gridfs-stream");
const cors = require("cors");

// пакет для работы с exifTool
const exiftool = require('node-exiftool')
// пакет для получения пути к исполняемому файлу exifTool
const exiftoolBin = require('dist-exiftool')
// запускаем exifTool
const ep = new exiftool.ExiftoolProcess(exiftoolBin)

const LIB_PATH = 'D:/IDB/bin'
// const PHOTO_PATH = path.join(__dirname, 'лысый2.jpg')
// const rs = fs.createReadStream(PHOTO_PATH)
//
// ep
//     .open()
//     .then((pid) => console.log('Started exiftool process %s', pid))
//     .then(() => ep.readMetadata(rs, ['-File:all']))
//     .then(console.log, console.error)
//     .then(() => ep.close())
//     .then(() => console.log('Closed exiftool'))
//     .catch(console.error)

const getExif = async (photoPath) => {
    const rs = fs.createReadStream(photoPath)
    await ep
        .open()
        .then((pid) => console.log('Started exiftool process %s', pid))
        .then(() => ep.readMetadata(rs, ['-File:all']))
        .then(console.log, console.error)
        .then(() => ep.close())
        .then(() => console.log('Closed exiftool'))
        .catch(console.error)
}

const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        fs.mkdirsSync(req.headers.path);
        cb(null, req.headers.path)
    },
    filename: function (req, file, cb) {
        // console.log("file-----", file)
        cb(null, file.originalname)
    }
})

const upload = multer({storage: storage})

app.use(cors());

// const jsonParser = express.json();

//определяет рабочую директорию (сейчас не нужно)
// app.use(express.static(__dirname));


// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(multer({ dest: "./uploads/" }).single("filedata"));
// app.use(
// 	multer({
// 		dest: "./uploads/",
// 		rename: function (fieldname, filename) {
// 			return filename.replace(/\W+/g, "-").toLowerCase() + Date.now();
// 		},
// 		onFileUploadStart: function (file) {
// 			console.log(file.fieldname + " is starting ...");
// 		},
// 		onFileUploadData: function (file, data) {
// 			console.log(data.length + " of " + file.fieldname + " arrived");
// 		},
// 		onFileUploadComplete: function (file) {
// 			console.log(file.fieldname + " uploaded to  " + file.path);
// 		},
// 	})
// )

const mongoClient = new MongoClient("mongodb://localhost:27017/", {
    useUnifiedTopology: true,
    useNewUrlParser: true
});

// app.use("/upload", upload.array("filedata"), function(req, res, next){
//   let path = req.files[0].destination + '/' + req.files[0].originalname
//   console.log('req.path: ', path)
//   let bom = loadImage.parseMetaData(
//       path,
//       function (data) {
//         console.log('req.path: ', path)
//         console.log('data: ', data)
//         // console.log('Original image head: ', data.imageHead)
//         // console.log('Exif data: ', data.exif) // requires exif extension
//         // console.log('IPTC data: ', data.iptc) // requires iptc extension
//       },
//   )
//   console.log("About Middleware");
//   // next()
// });

function middleware() {
    // console.log('parser: ', jsonParser)
    return upload.array("filedata")
}

app.post("/upload", middleware(), async function (req, res) {
    let filedata = req.files;
    if (!filedata) res.send("Ошибка при загрузке файла");
    // console.log('req.body', req.body);
    const filePath = req.headers.path


    const exifDataArr = JSON.parse(req.body.exifDataArr)
    filedata.map((item, i) => {
        item.keywords = exifDataArr[i].keywords
        item.changeDate = exifDataArr[i].changeDate
        item.originalDate = exifDataArr[i].originalDate || null
        return item
    })

    const exifDataPromiseArr = filedata.map(async (item, i) => {
        let path = filePath + '/' + item.originalname;
        return await getExif(path)
    })

    await Promise.all(exifDataPromiseArr)

    mongoClient.connect((err, client) => {
        if (err) {
            console.log("Connection error: ", err);
            throw createError(400, `oops..`);
        }
        console.log("Connected");

        const db = client.db("IDB");
        const collection = db.collection("photos");
        collection.insertMany(filedata, function (err, result) {
            if (err) {
                console.log("collection insert error", err);
                throw createError(400, `oops..`);
            }
            console.log(result);
            res.send("Файл загружен");
            // client.close();
            // console.log("Connect close");
        });
    });
});

// app.use(function (err, req, res, next) {
//   console.log("This is the invalid field ->", err.field);
//   next(err);
// });
app.use((error, req, res, next) => {
    res.status(error.status || 500)
    res.json({
        status: error.status,
        message: error.message,
        stack: error.stack
    })
})

const port = 5000;

app.listen(port, function () {
    console.log("Start listerning on port " + port);
});
