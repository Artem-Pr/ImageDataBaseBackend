const fs = require("fs-extra")
const createError = require("http-errors")
const sharp = require("sharp")
const {logger} = require("../utils/logger")
const {dateToString} = require('../utils/common')

//Todo: add tests
const getFilesFromDB = async (req, res, tempFolder, databaseFolder) => {
    let filedata = req.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        res.send('Downloading files error')
        return
    }
    
    const folderPath = filedata.folderPath
    const nPerPage = +filedata.perPage || 0
    let currentPage = +filedata.page || 1
    let searchTags = filedata.searchTags || []
    let excludeTags = filedata.excludeTags || []
    
    if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
    if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
    
    
    logger.debug('folderPath', {data: folderPath})
    logger.debug('searchTags', {data: searchTags})
    logger.debug('excludeTags', {data: excludeTags})
    
    // очищаем temp
    fs.emptyDirSync(tempFolder)
    
    const conditionArr = []
    if (folderPath) conditionArr.push({$expr: {$eq: [{$indexOfCP: ['$filePath', `/${folderPath}`]}, 0]}})
    if (searchTags.length) conditionArr.push({"keywords": {$in: searchTags || []}})
    if (excludeTags.length) conditionArr.push({"keywords": {$nin: excludeTags || []}})
    
    const findObject = conditionArr.length ? {$and: conditionArr} : {}
    
    const collection = req.app.locals.collection
    let resultsCount = 0
    let totalPages = 0
    
    const AllFoundedResults = collection.find(findObject)
    AllFoundedResults.count().then(response => {
        resultsCount = response
        totalPages = Math.ceil(resultsCount / nPerPage)
        if (currentPage > totalPages) currentPage = 1
    })
    AllFoundedResults
        .sort({mimetype: 1, originalDate: -1, filePath: 1})
        .skip(currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0)
        .limit(nPerPage)
        .toArray(async function (err, photos) {
            if (err) {
                logger.error("collection load error", {data: err})
                throw createError(400, `collection load error`)
            }
            
            logger.debug('rootLibPath', {message: databaseFolder})
            logger.info('Sharp start. Number of photos:', {message: photos.length})
            const filesWithTempPathPromise = photos.map(async item => {
                const fullPath = databaseFolder + item.filePath
                const staticPath = 'database' + item.filePath
                
                // если тип "video", то не делаем превью, а просто достаем его из папки, иначе делаем превью
                if (item.mimetype.startsWith('video')) {
                    const fullPreviewPath = 'database' + item.preview
                    item.originalPath = 'http://localhost:5000/' + staticPath
                    item.preview = 'http://localhost:5000/' + fullPreviewPath
                    item.tempPath = item.filePath
                } else {
                    const randomName = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
                    await sharp(fullPath)
                        .withMetadata()
                        .clone()
                        .resize(200, 200, {fit: 'outside'})
                        .jpeg({quality: 80})
                        .toFile('temp/' + randomName + '-preview.jpg')
                        .then(() => {
                            item.originalPath = 'http://localhost:5000/' + staticPath
                            item.preview = 'http://localhost:5000/images/' + randomName + '-preview.jpg'
                            item.tempPath = item.filePath
                            logger.info('Sharp SUCCESS:', {message: item.originalName})
                        })
                        .catch(err => logger.error('OOPS!, Sharp ERROR:', {data: err}))
                }
                return {
                    ...item,
                    ...(item.originalDate && {originalDate: dateToString(item.originalDate)})
                }
            })
            const filesWithTempPath = await Promise.all(filesWithTempPathPromise)
            const responseObject = {
                files: filesWithTempPath,
                searchPagination: {currentPage, totalPages, nPerPage, resultsCount}
            }
            logger.http('POST-response', {
                message: '/filtered-photos',
                data: {
                    filesLength: responseObject.files.length,
                    searchPagination: responseObject.searchPagination
                }})
            res.send(responseObject)
        });
}

module.exports = {getFilesFromDB}
