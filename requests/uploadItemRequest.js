const {logger} = require("../utils/logger")
const {getAndSendError, pickFileName} = require("../utils/common")
const {getSameFilesIfExist} = require("../utils/getSameFilesIfExists")
const {UPLOAD_TEMP_FOLDER} = require("../constants")
const {PreviewCreator} = require('../utils/previewCreator/previewCreator');

const uploadItemRequest = async (req, res) => {
    let filedata = req.file
    if (!filedata) {
        logger.error("Request doesn't contain filedata")
        logger.http('POST-response', {message: '/uploadItem', data: "Uploading file error"})
        res.send("Uploading file error")
    }
    
    const root = {
        original: UPLOAD_TEMP_FOLDER,
        targetPreview: UPLOAD_TEMP_FOLDER,
    }
    
    const hashName = pickFileName(filedata.filename)

    const existedFilesArr = await getSameFilesIfExist(req, filedata.originalname)
    
    const previewCreator = new PreviewCreator({filedata, root, hashName})
    previewCreator
        .startProcess()
        .then(({result}) => {
            const responseObject = {
                ...result,
                existedFilesArr,
            }
            logger.http('POST-response', {message: '/uploadItem', data: responseObject})
            res.send(responseObject)
        })
        .catch(err => getAndSendError(
            res,
            "POST",
            '/uploadItem',
            err.message,
            'uploadItemRequest'
        ))
}

module.exports = {uploadItemRequest}
