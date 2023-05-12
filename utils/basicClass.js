const {throwError} = require('../utils/common');
const {logger} = require('../utils/logger');

class BasicClass {
    _moduleName = 'BasicClass'
    /**
     * @param {string} moduleName
     */
    constructor(moduleName) {
        moduleName && (this._moduleName = moduleName)
    }
    
    infoLog(title, message, data, moduleName) {
        logger.info(title, {
            ...(message && {message: ` - ${message}`}),
            ...(data && {data}),
            module: moduleName || this._moduleName,
        })
    }
    
    successLog(message, data, moduleName) {
        logger.info(message, {
            message: ': SUCCESS',
            ...(data && {data}),
            module: moduleName || this._moduleName
        })
    }
    
    errorLog(errorMessage, data, moduleName) {
        logger.error(errorMessage, {
            message: ': ERROR',
            ...(data && {data}),
            module: moduleName || this._moduleName
        })
    }
    
    throwError(errorMessage) {
        this.errorLog(errorMessage)
        throwError(errorMessage, true)
    }
}

module.exports = {BasicClass}
