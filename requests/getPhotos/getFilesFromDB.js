const fs = require("fs-extra")
const {isEmpty} = require("ramda")
const {logger} = require("../../utils/logger")
const {removeFileExt} = require('../../utils/common')
const {DBRequests} = require('../../utils/DBController');
const {TEMP_FOLDER, DATABASE_FOLDER} = require('../../constants')
const {createPreviewAndSendFiles} = require('./helpers/createPreviewAndSendFiles');
const { getDynamicFoldersArr } = require('./helpers/getDynamicFoldersArr');

const getName = (dbObject) => removeFileExt(dbObject.originalName)
// const getName = (dbObject) => dbObject.size //нужно для изменения вариантов сравнения

const isOtherFolder = (dbObject, folder) => dbObject.filePath.startsWith(`/${folder}/`)

//Todo: add tests
/**
 * Getting the filtered and sorted elements from DB
 *
 * @param {object} req
 * @param {locals: {collection: {
 *    aggregate: (Array, object) => ({toArray: () => Promise<any>})
 * }}} req.app.locals - express instance
 * @param {object | null} req.body - request body
 * @param {boolean?} req.body.anyDescription - return only files with description
 * @param {string?} req.body.comparisonFolder - used for test purpose
 * @param {[string, string]?} req.body.dateRange - tuple of dates (date format: 2023-05-23T13:44:03+02:00)
 * @param {string?} req.body.description - part of file description
 * @param {string[]?} req.body.excludeTags - excluded keywords
 * @param {string?} req.body.fileName - file name (any string)
 * @param {string} req.body.folderPath - folder path ("main/1")
 * @param {boolean?} req.body.includeAllSearchTags - return only files that contain all request tags
 * @param {boolean?} req.body.isFullSizePreview - use original files as preview
 * @param {boolean?} req.body.isNameComparison - used for test purposes
 * @param {string[]?} req.body.mimetypes - list of target mimetypes (["image/gif"])
 * @param {number} req.body.page - 0
 * @param {number} req.body.perPage - 100
 * @param {boolean?} req.body.randomSort - return random files from DB
 * @param {number?} req.body.rating - number from 0 to 5
 * @param {string[]?} req.body.searchTags - included keywords
 * @param {boolean?} req.body.showSubfolders - show files from current directory and all subdirectories
 * @param {boolean?} req.body.dontSavePreview - all preview will be created in temp folder
 * @param {object} req.body.sorting - object with sorting fields
 * @param {1 | -1?} req.body.sorting.description
 * @param {1 | -1?} req.body.sorting.filePath
 * @param {1 | -1?} req.body.sorting.megapixels
 * @param {1 | -1?} req.body.sorting.mimetype
 * @param {1 | -1?} req.body.sorting.originalDate
 * @param {1 | -1?} req.body.sorting.originalName
 * @param {1 | -1?} req.body.sorting.rating
 * @param {1 | -1?} req.body.sorting.size
 * @param {1 | -1?} req.body.sorting._id
 *
 * @param {object} res - response object. Minimal: {send: null}
 */
const getFilesFromDB = async (req, res) => {
    let filedata = req.body
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        res.send('Downloading files error')
        return
    }
    
    const isDynamicFolders = Boolean(filedata.isDynamicFolders)
    const randomSort = Boolean(filedata.randomSort)
    const sorting = filedata.sorting
    const folderPath = filedata.folderPath
    const nPerPage = +filedata.perPage || 0
    const isNameComparison = Boolean(filedata.isNameComparison)
    const comparisonFolder = filedata.comparisonFolder
    const showSubfolders = filedata.showSubfolders
    const dontSavePreview = Boolean(filedata.dontSavePreview)
    const includeAllSearchTags = filedata.includeAllSearchTags
    const types = filedata.mimetypes || []
    const isFullSizePreview = Boolean(filedata.isFullSizePreview)
    
    const ratingFilter = +filedata.rating || 0
    const dateRangeFilter = filedata.dateRange
    const fileNameFilter = filedata.fileName
    const anyDescriptionFilter = filedata.anyDescription
    const descriptionFilter = filedata.description
    let currentPage = +filedata.page || 1
    let searchTags = filedata.searchTags || []
    let excludeTags = filedata.excludeTags || []
    
    if (searchTags && !Array.isArray(searchTags)) searchTags = [searchTags]
    if (excludeTags && !Array.isArray(excludeTags)) excludeTags = [excludeTags]
    
    
    logger.debug('randomSort', {data: randomSort})
    logger.debug('sorting', {data: JSON.stringify(sorting)})
    
    logger.debug('isNameComparison', {data: isNameComparison})
    logger.debug('comparisonFolder', {data: comparisonFolder})
    logger.debug('isFullSizePreview', {data: isFullSizePreview})
    
    logger.debug('folderPath', {data: folderPath})
    logger.debug('showSubfolders', {data: showSubfolders})
    logger.debug('dontSavePreview', {data: dontSavePreview})
    logger.debug('fileNameFilter', {data: fileNameFilter})
    logger.debug('ratingFilter', {data: ratingFilter})
    logger.debug('anyDescriptionFilter', {data: anyDescriptionFilter})
    logger.debug('descriptionFilter', {data: descriptionFilter})
    logger.debug('searchTags', {data: searchTags})
    logger.debug('excludeTags', {data: excludeTags})
    logger.debug('types', {data: types})
    logger.debug('dateRangeFilter', {data: dateRangeFilter})
    
    // очищаем temp
    fs.emptyDirSync(TEMP_FOLDER)
    
    const conditionArr = []
        
    if (fileNameFilter) conditionArr.push(
        {originalName: {'$regex': fileNameFilter, '$options': 'i'}}
    )
    
    if (ratingFilter) conditionArr.push(
        {rating: {'$eq': ratingFilter}}
    )
    
    if (descriptionFilter) conditionArr.push(
        {description: {'$regex': descriptionFilter, '$options': 'i'}}
    )
    
    if (anyDescriptionFilter) conditionArr.push(
        {description: {"$exists": true, "$ne": ""}}
    )
    
    const searchTagsCondition = includeAllSearchTags
        ? {keywords: {$all: searchTags || []}}
        : {keywords: {$in: searchTags || []}}
    if (searchTags.length) conditionArr.push(searchTagsCondition)
    if (excludeTags.length) conditionArr.push({keywords: {$nin: excludeTags || []}})
    if (types.length) {
        const mimeTypeObjArr = types.map(type => ({mimetype: type}))
        conditionArr.push({$or: mimeTypeObjArr})
    }
    if (dateRangeFilter) {
        const startDate = new Date(dateRangeFilter[0])
        const endDate = new Date(dateRangeFilter[1])
        
        conditionArr.push(
            {originalDate: {$gte: startDate, $lt: endDate}}
        )
    }

    const collection = req.app.locals.collection
    const dynamicFolders = isDynamicFolders 
        ? await getDynamicFoldersArr(collection, conditionArr) // put conditionArr before adding paths
        : []

    if (folderPath && showSubfolders) conditionArr.push(
        {$expr: {$eq: [{$indexOfCP: ['$filePath', `/${folderPath}/`]}, 0]}}
    )
    if (folderPath && !showSubfolders) {
        conditionArr.push(DBRequests.getFilesExcludeFilesInSubfolders(folderPath))
    }
    
    const findObject = conditionArr.length ? {$and: conditionArr} : {}
    
    const aggregationMatch = {$match: findObject}
    const aggregationSort = {$sort: sorting}
    const aggregationSample = {$sample: {size: nPerPage}}
    const aggregationResponse = {
        $facet: {
            response: [
                {$skip: currentPage > 0 ? ((currentPage - 1) * nPerPage) : 0},
                {$limit: nPerPage},
            ],
            total: [
                {$group: {_id: null, filesSizeSum: {$sum: '$size'}}},
                {$unset: "_id"}
            ],
            pagination: [
                {$count: 'resultsCount'},
                {
                    $addFields: {
                        totalPages: {
                            $ceil: {
                                $divide: ['$resultsCount', nPerPage],
                            }
                        },
                    }
                },
                {
                    $addFields: {
                        currentPage: {
                            $cond: [{$gt: [currentPage, '$totalPages']}, 1, currentPage]
                        }
                    }
                }
            ]
        }
    }
    
    let aggregationArray = [aggregationMatch]
    !(randomSort || isEmpty(sorting)) && aggregationArray.push(aggregationSort)
    randomSort && aggregationArray.push(aggregationSample)
    aggregationArray.push(aggregationResponse)
    
    const comparisonAggregationArray = [
        {$match: findObject},
        {$sort: {originalName: 1}},
        {
            $facet: {
                response: [],
                total: [
                    {$group: {_id: null, filesSizeSum: {$sum: '$size'}}},
                    {$unset: "_id"}
                ],
                pagination: []
            }
        }
    ]
    
    try {
        const [mongoResponse] = await collection
            .aggregate(
                isNameComparison
                    ? comparisonAggregationArray
                    : aggregationArray,
                {allowDiskUse: true})
            .toArray()
        
        const {response, total, pagination} = mongoResponse
        const filesSizeSum = total[0] ? total[0].filesSizeSum : 0
        
        logger.debug('rootLibPath', {message: DATABASE_FOLDER})
        
        if (!isNameComparison) {
            const {resultsCount, totalPages, currentPage} = pagination.length
                ? pagination[0]
                : {resultsCount: 0, totalPages: 0, currentPage: 0}
            const searchPagination = {currentPage, totalPages, nPerPage, resultsCount}
            
            await createPreviewAndSendFiles(res, response, searchPagination, filesSizeSum, isFullSizePreview, dontSavePreview, req, dynamicFolders)
            return
        }
        
        const filteredPhotos = response.filter((item, idx) => {
            const prevItem = idx > 0 && response[idx - 1]
            const nextItem = idx < response.length && response[idx + 1]
            if (comparisonFolder) {
                return prevItem && isOtherFolder(item, comparisonFolder) && getName(item).startsWith(getName(prevItem)) || // сравнение имен с папкой other
                    prevItem && isOtherFolder(prevItem, comparisonFolder) && getName(prevItem).startsWith(getName(item)) ||
                    nextItem && isOtherFolder(item, comparisonFolder) && getName(item).startsWith(getName(nextItem)) ||
                    nextItem && isOtherFolder(nextItem, comparisonFolder) && getName(nextItem).startsWith(getName(item));
            } else {
                return prevItem && getName(item).startsWith(getName(prevItem)) ||  // сравнение имен везде
                    prevItem && getName(prevItem).startsWith(getName(item)) ||
                    nextItem && getName(item).startsWith(getName(nextItem)) ||
                    nextItem && getName(nextItem).startsWith(getName(item));
            }
            // return prevItem && getName(item) === getName(prevItem) || // сравнение поля size (нужно исправить также getName)
            //     prevItem && getName(prevItem) === getName(item) ||
            //     nextItem && getName(item) === getName(nextItem) ||
            //     nextItem && getName(nextItem) === getName(item);
            
        })
        
        const searchPagination = {currentPage: 1, totalPages: 1, nPerPage: 100, resultsCount: 0}
        await createPreviewAndSendFiles(res, filteredPhotos, searchPagination, filesSizeSum, isFullSizePreview, dontSavePreview, req)
    } catch (err) {
        logger.error("collection load error:", {message: err.message})
        res.status(500).send({message: `collection load error: ${err.message}`})
    }
}

module.exports = {getFilesFromDB}
