const {logger} = require('../utils/logger');

class regExp {
    /**
     * Get escaped string
     * @param {string} string
     * @return {string}
     */
    static getEscapedString(string) {
        return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
    }
    
    /**
     * Get folder path RegExp, which starts with the current folder and excludes subfolders
     * @param {string} folderPathEscaped
     * @return {RegExp}
     */
    static getFolderPathExcludeSubFolder(folderPathEscaped) {
        const folderPathRegex = new RegExp(`^/${folderPathEscaped}/[^/]+\\.*$`)
        console.log('folderPathRegex', folderPathRegex)
        logger.debug('folderPathRegex', {message: folderPathRegex})
        return folderPathRegex
    }
}

module.exports = {
    regExp
}
