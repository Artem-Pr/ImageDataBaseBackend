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
const tempFolder = 'temp'

const getExif = async (pathsArr) => {
    try {
        const pid = await ep.open()
        console.log('Started exiftool process %s', pid)

        const keywordsPromiseArr = pathsArr.map(async tempImgPath => {
            const rs = fs.createReadStream(tempImgPath)
            return await ep.readMetadata(rs, ['Keywords'])
        })
        const exifResponse = await Promise.all(keywordsPromiseArr)

        await ep.close()
        console.log('Closed exiftool')

        return exifResponse
    } catch (e) {
        console.error(e)
        throw createError(500, `oops..`);
    }
}

const pushExif = async (pathsArr, changedKeywordsArr) => {
    try {
        const pid = await ep.open()
        console.log('Started exiftool process %s', pid)

        const response = pathsArr.map(async (tempImgPath, i) => {
            if (changedKeywordsArr[i]) {
                const currentPhotoPath = tempImgPath.replace(/\//g, '\\')
                return await ep.writeMetadata(currentPhotoPath, {
                    'Keywords+': changedKeywordsArr[i],
                }, ['overwrite_original'])
            } else {
                return null
            }
        })
        await Promise.all(response)

        await ep.close()
        console.log('Closed exiftool')
    } catch (e) {
        console.error(e)
        throw createError(500, `oops..`);
    }
}

const getConfig = () => {
    try {
        return fs.readFileSync(configPath, "utf8")
    } catch (err) {
        console.error('Config.json не найден: ', err)
        throw createError(500, `oops..`);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // fs.mkdirsSync(req.headers.path);
        // cb(null, req.headers.path)
        cb(null, tempFolder)
    },
    // filename: function (req, file, cb) {
    //     console.log("file-----", file)
    //     console.log("req-----", req)
    //     cb(null, file.originalname)
    // }
})

const upload = multer({storage: storage})

app.use(cors());

function middleware() {
    // console.log('parser: ', jsonParser)
    return upload.array("filedata")
}

app.get("/keywords", function (req, res) {
    const config = getConfig()
    res.send(config)
})

app.post("/upload", middleware(), async function (req, res) {
    const targetFolder = req.headers.path
    let filedata = req.files;
    if (!filedata) res.send("Ошибка при загрузке файла");
    // console.log('req.body', req.body);

    // парсим массив с параметрами, затем добавляем параметры в общий файл "filedata"
    const exifDataArr = JSON.parse(req.body.exifDataArr)
    filedata.map((item, i) => {
        item.keywords = exifDataArr[i].keywords
        item.changeDate = exifDataArr[i].changeDate
        item.originalDate = exifDataArr[i].originalDate || null
        return item
    })

    const pathsArr = filedata.map(dataItem => dataItem.path)
    const exifResponse = await getExif(pathsArr)

    // Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
    // также походу добавляем все ключевые слова в массив keywordsRawList
    let keywordsRawList = []
    const changedKeywordsArr = exifResponse.map((item, i) => {
        // keywords с фронта (возможно дополненные)
        const newKeywords = filedata[i].keywords || []
        // keywords из exifTools (возможно не существуют, тогда возвращаем null)
        let originalKeywords = item.data[0].Keywords || []

        if (typeof originalKeywords === "string") originalKeywords = [originalKeywords]
        else originalKeywords = originalKeywords.map(item => item.trim())

        keywordsRawList = [...keywordsRawList, ...originalKeywords, ...newKeywords]

        // Если keywords изменены, то записываем в массив и в filedata, если нет, пишем null
        if (originalKeywords.join('') !== newKeywords.join('')) {
            const updatedKeywordsSet = new Set([...newKeywords, ...originalKeywords])
            filedata[i].keywords = [...updatedKeywordsSet]
            return [...updatedKeywordsSet]
        } else {
            return null
        }
    })

    // Записываем измененные ключевые слова в файлы в папке темп
    await pushExif(pathsArr, changedKeywordsArr)

    // Переносим картинки в папку библиотеки
    filedata.forEach(item => {
        const targetPath = targetFolder + '/' + item.originalname
        try {
            fs.moveSync(item.path, targetPath)
        } catch (e) {
            console.error(e)
            throw createError(500, `oops..`);
        }
    })

    // Складываем список keywords в config
    const configKeywords = JSON.parse(getConfig()).keywords
    const keywordsSet = new Set([...configKeywords, ...keywordsRawList])
    const configObj = {keywords: [...keywordsSet].sort()}
    fs.writeFileSync(configPath, JSON.stringify(configObj))

    // Подготавливаем файл базы данных
    filedata = filedata.map(image => ({
        originalname: image.originalname,
        encoding: image.encoding,
        mimetype: image.mimetype,
        size: image.size,
        keywords: image.keywords,
        changeDate: image.changeDate,
        originalDate: image.originalDate,
    }))

    const mongoClient = new MongoClient("mongodb://localhost:27017/", {
        useUnifiedTopology: true,
        useNewUrlParser: true
    });

    await mongoClient.connect((err, client) => {
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
            client.close();
            console.log("Connect close");
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

const server = app.listen(port, function () {
    console.log("Start listerning on port " + port);
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
