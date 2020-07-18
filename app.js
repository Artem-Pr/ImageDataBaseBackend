const express = require("express");
const createError = require('http-errors')
const multer = require("multer");
let fs = require('fs-extra');
const MongoClient = require("mongodb").MongoClient;
const cors = require("cors");
// пакет для работы с exifTool
const exiftool = require('node-exiftool')
// пакет для получения пути к исполняемому файлу exifTool
const exiftoolBin = require('dist-exiftool')
// запускаем exifTool
const ep = new exiftool.ExiftoolProcess(exiftoolBin)
const app = express();
const configPath = 'config.json'

const getExif = async (photoPath) => {
    const rs = fs.createReadStream(photoPath)
    let keywords = []
    await ep
        .open()
        .then((pid) => console.log('Started exiftool process %s', pid))
        .then(() => ep.readMetadata(rs, ['Keywords']))
        .then(k => {
            keywords = k
        }, console.error)
        .then(() => ep.close())
        .then(() => console.log('Closed exiftool'))
        .catch(console.error)
    return keywords
}

const pushExif = async (photoPath, keywords) => {
    // меняем направление слеша в пути к файлу
    const currentPhotoPath = photoPath.replace(/\//g, '\\')
    await ep
        .open()
        .then(() => ep.writeMetadata(currentPhotoPath, {
            'Keywords+': keywords,
        }, ['overwrite_original']))
        .then(console.log, console.error)
        .then(() => ep.close())
        .catch(console.error)
}

const getConfig = () => {
    try {
        return  fs.readFileSync(configPath, "utf8")
    } catch (err) {
        console.error('Config.json не найден: ', err)
        throw createError(500, `oops..`);
    }
}

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

const mongoClient = new MongoClient("mongodb://localhost:27017/", {
    useUnifiedTopology: true,
    useNewUrlParser: true
});

function middleware() {
    // console.log('parser: ', jsonParser)
    return upload.array("filedata")
}

app.get("/keywords", function (req, res) {
    const config = getConfig()
    res.send(config)
})

app.post("/upload", middleware(), async function (req, res) {
    let filedata = req.files;
    if (!filedata) res.send("Ошибка при загрузке файла");
    // console.log('req.body', req.body);
    const filePath = req.headers.path

    // парсим массив с параметрами, затем добавляем параметры в общий файл "filedata"
    const exifDataArr = JSON.parse(req.body.exifDataArr)
    filedata.map((item, i) => {
        item.keywords = exifDataArr[i].keywords
        item.changeDate = exifDataArr[i].changeDate
        item.originalDate = exifDataArr[i].originalDate || null
        return item
    })

    // Получаем exif из всех фоточек в папке, и помещаем промисы в массив
    const exifDataPromiseArr = filedata.map(async (item) => {
        let path = filePath + '/' + item.originalname;
        return await getExif(path)
    })

    // Достаем массив массивов keyword
    const exifResponse = await Promise.all(exifDataPromiseArr)

    // Сравниваем keywords из картинок и пришедшие (возможно измененные), дописываем новые в картинки,
    // затем сохраняем все слова в Set
    let keywordsRawList = []
    exifResponse.forEach((item, i) => {
        // keywords с фронта (возможно дополненные)
        const newKeywords = filedata[i].keywords || []
        // keywords из exifTools (возможно не существуют, тогда возвращаем null)
        let originalKeywords = item.data[0].Keywords || []

        if (typeof originalKeywords === "string") originalKeywords = [originalKeywords]
        else originalKeywords = originalKeywords.map(item => item.trim())

        if (originalKeywords.join('') !== newKeywords.join('')) {
            pushExif(filedata[i].path, newKeywords)
        }
        keywordsRawList = [...keywordsRawList, ...originalKeywords, ...newKeywords]
    })

    // Складываем список keywords в config
    const configKeywords = JSON.parse(getConfig()).keywords
    const keywordsSet = new Set([ ...configKeywords, ...keywordsRawList ])
    const configObj = {keywords: [...keywordsSet].sort()}
    fs.writeFileSync(configPath, JSON.stringify(configObj))


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
