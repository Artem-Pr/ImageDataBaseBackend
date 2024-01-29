const {logger} = require("../utils/logger")
const { getParam } = require("../utils/common")
const { getSameFilesIfExist } = require("../utils/getSameFilesIfExists")

const checkDuplicates = async (req, res) => {
    const fileNames = getParam(req, 'names')
    if (!Array.isArray(fileNames)) {
        logger.error("checking duplicates error:", {message: 'fileNames is not array'})
        res.status(500).send({message: 'fileNames is not array'})
        return
    }

    const existedFilesArrPromise = fileNames
        .map(name => getSameFilesIfExist(req, name)
        .then(result => ({
            [name]: result
        })))
    const existedFilesArr = await Promise.all(existedFilesArrPromise)
    const existedFilesObject = existedFilesArr.reduce((acc, item) => {
        return {
            ...acc,
            ...item
        }
    }, {})

    logger.http('GET-response', {message: '/check-duplicates', data: existedFilesObject})
    res.send(existedFilesObject)
}

module.exports = {checkDuplicates}