const moment = require("moment")
const createError = require("http-errors")
const {throwError} = require("./common")
const {logger} = require("./logger")
const {dateTimeFormat} = require('./dateFormat');

const exiftool = require("exiftool-vendored").exiftool

exiftool
    .version()
    .then((version) => logger.info(`running ExifTool v${version}`))

/**
 * log exifTool response, return true if everything is ok,
 * throw error if something went wrong
 *
 * @param exifToolResponseArr
 * @return true
 */
const preparedResponse = exifToolResponseArr => {
    return exifToolResponseArr.reduce((sum, item, i) => {
        if (item.data) {
            logger.info(`exifTool-${i}:`, {data: item.data})
            return sum && true
        }
        if (item.error.includes('1 image files updated')) {
            logger.info(`exifTool-${i}:`, {message: '1 image files updated with WARNING'})
            return sum && true
        }
        logger.error(`exifTool-${i}:`, {data: item.error})
        throw new Error('exifTool-' + i + ': OOPS!' + item.error)
    }, true)
}

/**
 * @param {string[]} fullPathsArr
 * @param {string[]} shortPaths
 * @return {Promise<Object>}
 */
const getExifFromPhoto = async (fullPathsArr, shortPaths) => {
    const exifObjArr = {}
    
    try {
        for (let i = 0; i < fullPathsArr.length; i++) {
            logger.debug('getExifFromPhoto - filePath:', {message: fullPathsArr[i]})
            exifObjArr[shortPaths[i]] = await exiftool.read(fullPathsArr[i])
        }
    } catch (e) {
        logger.info('Close exiftool')
        await exiftool.end()
        throw throwError('getExifFromPhoto - ' + e.message)
    }
    
    return exifObjArr
}

/**
 * Return array of exif strings
 *
 * @param {string[]} pathsArr - array of paths to the files
 * @returns {Promise<string[]>}
 */
const getExifFromArr = async (pathsArr) => {
    try {
        const keywordsPromiseArr = pathsArr.map(async tempImgPath => {
            const rs = tempImgPath.replace(/\//g, '\/')
            logger.debug('getExifFromPhoto - tempImgPath:', {message: rs})
            
            return exiftool.read(rs)
        })
        
        return await Promise.all(keywordsPromiseArr)
    } catch (e) {
        logger.info('Close exiftool')
        await exiftool.end()
        logger.error('', {data: e})
        throw createError(500, `oops..`);
    }
}

/**
 *
 * @param {string} type
 * @return {boolean}
 */
const isInvalidFormat = (type) => (type === 'video/avi') || (type === 'video/wmv')

/**
 * Push exif array.
 *
 * @param {string[]} pathsArr - array of paths to the files
 * @param {string[][]} changedKeywordsArr - array of keywords arrays
 * @param {[]} filedata - array of dataBase objects
 */
const pushExif = async (pathsArr, changedKeywordsArr, filedata) => {
    const responsePromise = pathsArr.map(async (currentPath, i) => {
        const isAvoidEmptyFields = filedata[i].type === 'image/gif'
        if (isInvalidFormat(filedata[i].type)) {
            logger.info('omit invalid format -', {message: filedata[i].type})
            return 'invalidFormat'
        }
        const currentPhotoPath = currentPath.replace(/\//g, '\/')
        const isChangedKeywordsItem = Boolean(changedKeywordsArr[i] && changedKeywordsArr[i].length)
        const keywords = isChangedKeywordsItem ? changedKeywordsArr[i] : ""
        
        let originalDate = null
        if (
            filedata[i].originalDate
            && filedata[i].originalDate !== ''
            && filedata[i].originalDate !== '-'
        ) {
            originalDate = moment(filedata[i].originalDate, dateTimeFormat).format(dateTimeFormat)
        }
        
        const getExifField = (fieldName, fieldValue) => {
            if (isAvoidEmptyFields) {
                return fieldValue ? {[fieldName]: fieldValue.join(' ')} : undefined
            }
            return {[fieldName]: fieldValue}
        }
        
        const preparedExif = {
            ...getExifField('Keywords', keywords),
            ...getExifField('Subject', keywords),
            ...(originalDate && {'AllDates': originalDate}),
            ...(originalDate && {'MediaCreateDate': originalDate}),
            ...(filedata[i].rating && {'Rating': filedata[i].rating}),
            ...(filedata[i].description && {'Description': filedata[i].description}),
            ...(filedata[i].description && {'ImageDescription': filedata[i].description}),
            ...(filedata[i].description && {'Caption-Abstract': filedata[i].description}),
            ...(filedata[i].description && {'UserComment': filedata[i].description}),
        }
        
        const isEmptyExif = Object.keys(preparedExif).length === 0 && preparedExif.constructor === Object
        return isEmptyExif || await exiftool
            .write(
                currentPhotoPath,
                preparedExif,
                ['-overwrite_original', "-codedcharacterset=utf8"]
            )
            .then(response => {
                logger.info('ExifTool SUCCESS: pushExif - file: ' + currentPhotoPath)
                logger.debug('preparedExif', {data: preparedExif})
                return response
            })
            .catch((error) => {
                throw new Error(`exifTool- write ERROR: ${error.message}`)
            })
    })
    
    await Promise.all(responsePromise)
}

module.exports = {getExifFromPhoto, getExifFromArr, pushExif, preparedResponse}
