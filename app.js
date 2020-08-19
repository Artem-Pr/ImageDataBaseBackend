const moment = require('moment');
const url = require('url');
const express = require("express");
const createError = require('http-errors')
const multer = require("multer");
let fs = require('fs-extra');
const sharp = require('sharp');
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
const port = 5000;


const getExifFormPhoto = async (tempImgPath) => {
    try {
        const pid = await ep.open()
        console.log('Started exiftool process %s', pid)

        const rs = fs.createReadStream(tempImgPath)
        const exifResponse = await ep.readMetadata(rs, ['-File:all'])

        await ep.close()
        console.log('Closed exiftool')

        return exifResponse.data
    } catch (e) {
        console.error(e)
        throw createError(500, `oops..`);
    }
}

const getExifFromArr = async (pathsArr) => {
    try {
        const pid = await ep.open()
        console.log('Started exiftool process %s', pid)

        const keywordsPromiseArr = pathsArr.map(async tempImgPath => {
            const rs = fs.createReadStream(tempImgPath)
            return await ep.readMetadata(rs, ['-File:all'])
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
            if (changedKeywordsArr[i] && changedKeywordsArr[i].length) {
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

const moveFileAndCleanTemp = async (tempPath, targetPath) => {
    await fs.moveSync(tempPath, targetPath)
    await fs.remove(tempPath + '-preview.jpg')
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
app.use('/images', express.static(__dirname + '/temp'));


function middleware() {
    // console.log('parser: ', jsonParser)
    return upload.array("filedata")
}

app.get("/keywords", function (req, res) {
    // очищаем temp
    fs.emptyDirSync(tempFolder);
    // получаем конфиг
    const config = getConfig()
    res.send(config)
})

app.post("/uploadItem", upload.single("filedata"), async function (req, res) {
    let filedata = req.file;
    if (!filedata) res.send("Ошибка при загрузке файла");
    console.log('filedata', filedata);

    sharp(filedata.path)
        .clone()
        .resize(200)
        .jpeg({ quality: 80 })
        .toFile(filedata.path + '-preview.jpg')
        .then(() => {
            const photoProps = {
                preview: 'http://localhost:5000/images/' + filedata.filename + '-preview.jpg',
                tempPath: filedata.path,
            }
            res.send(photoProps)
        })
        .catch( err => console.log('err', err));
})

app.get("/image-exif", async function (req, res) {
    const queryObject = url.parse(req.url,true).query;
    const tempImgPath = queryObject.tempPath
    console.log('tempImgPath', tempImgPath)
    if (!tempImgPath) res.send("Ошибка при получении keywords");

    const exifObject = await getExifFormPhoto(tempImgPath)
    res.send(JSON.stringify(exifObject[0]))
})

app.use("/upload", express.json({extended: true}))

app.post("/upload", async function (req, res) {
    const targetFolder = req.headers.path
    let filedata = req.body;
    if (!filedata) res.send("Ошибка при загрузке файла");
    console.log('filedata', filedata);

    // парсим массив с параметрами, затем добавляем параметры в общий файл "filedata"
    // const exifDataArr = JSON.parse(req.body.exifDataArr)
    // filedata.map((item, i) => {
    //     item.keywords = exifDataArr[i].keywords
    //     item.changeDate = exifDataArr[i].changeDate
    //     item.originalDate = exifDataArr[i].originalDate || null
    //     return item
    // })

    let pathsArr = filedata.map(dataItem => dataItem.tempPath)

    console.log('pathsArr', pathsArr)
    const exifResponse = await getExifFromArr(pathsArr)

    // Сравниваем keywords из картинок и пришедшие (возможно измененные), записываем в массив новые keywords или null
    // также походу добавляем все ключевые слова в массив keywordsRawList
    let keywordsRawList = []
    const changedKeywordsArr = exifResponse.map((item, i) => {
        // keywords с фронта (возможно дополненные)
        const newKeywords = filedata[i].keywords
            ? filedata[i].keywords.map(item => item.trim())
            : []

        // добавляем в filedata дату создания фоточки
        // нашел много разных вариантов даты, возможно надо их протестировать
        const originalDate = item.data[0].DateTimeOriginal
        if (originalDate) {
            filedata[i].originalDate = moment(originalDate, 'YYYY:MM:DD hh:mm:ss').format('DD.MM.YYYY')
        }

        // keywords из exifTools (возможно не существуют, тогда возвращаем null)
        let originalKeywords = item.data[0].Keywords || []

        if (typeof originalKeywords === "string") originalKeywords = [originalKeywords]
        else originalKeywords = originalKeywords.map(item => item.trim())

        keywordsRawList = [...keywordsRawList, ...originalKeywords, ...newKeywords]

        // Если keywords были удалены, то оставляем пустой массив
        if (filedata[i].keywords && filedata[i].keywords.length === 0) return []
        // Если keywords не изменены, то записываем в filedata оригинальные
        if (newKeywords.length) return newKeywords
        else return originalKeywords
    })
    console.log('changedKeywordsArr', changedKeywordsArr)

    // Записываем измененные ключевые слова в файлы в папке темп
    await pushExif(pathsArr, changedKeywordsArr)

    // Переносим картинки в папку библиотеки
    filedata.forEach(item => {
        const targetPath = targetFolder + '/' + item.name
        try {
            moveFileAndCleanTemp(item.tempPath, targetPath)
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
    filedata = filedata.map((image, i) => ({
        originalname: image.name,
        mimetype: image.type,
        size: image.size,
        megapixels: image.megapixels,
        keywords: changedKeywordsArr[i],
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
