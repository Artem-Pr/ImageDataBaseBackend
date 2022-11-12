const fs = require("fs-extra")
const createError = require("http-errors")
const {logger} = require("../utils/logger")
const {TEMP_FOLDER, UPLOAD_TEMP_FOLDER} = require("../constants")

const keywordsRequest = (request, response) => {
    logger.debug('tempFolder', {message: TEMP_FOLDER})
    
    // temp clearing
    fs.emptyDirSync(TEMP_FOLDER);
    fs.emptyDirSync(UPLOAD_TEMP_FOLDER);
    
    const configCollection = request.app.locals.configCollection;
    configCollection.findOne({name: "keywords"}, function (err, res) {
        if (err) {
            logger.error('configCollection.findOne (keywords)', {data: err})
            throw createError(400, `configCollection find keywords error`)
        }
    
        const keywordsRes = res ? res.keywordsArr : []
        
        logger.http('GET-response', {message: '/keywords', data: `long-list (keywordsRes: ${keywordsRes})`})
        response.send(keywordsRes)
    })
}

module.exports = {keywordsRequest}
