const {logger} = require("./logger")
const {removeDirController} = require("../requests/removeDirectory")
const {getUniqPaths, throwError} = require("./common")

/**
 * @param req
 * @param {string | string[]} basePathWithoutRootDirectory
 * @return {Promise<string>} newPathsArr - array of all new paths
 */
const addPathToBase = async (req, basePathWithoutRootDirectory) => {
    try {
        //Todo: create another controller for this goal and move paths logic from "removeDirController" to new one
        const pathsController = new removeDirController(null, req, undefined, basePathWithoutRootDirectory)
        await pathsController.fetchPathsConfig('init')
        const basePaths = Array.isArray(basePathWithoutRootDirectory)
            ? basePathWithoutRootDirectory
            : [basePathWithoutRootDirectory]
        const newPathsArr = getUniqPaths(basePaths)
        
        if (!pathsController.pathsConfigArr) {
            await pathsController.foldersController.insertOne({pathsArr: newPathsArr}, 'configCollection')
            logger.info('Add paths to config:', {data: newPathsArr, module: 'addPathToBase'})
            return newPathsArr
        }
        logger.debug('pathsArr', {data: newPathsArr, module: 'addPathToBase'})
        
        const pathsSet = new Set([...newPathsArr, ...pathsController.pathsConfigArr])
        pathsSet.delete('')
        const newPathsList = Array.from(pathsSet).sort()
        
        await pathsController.updatePathsConfig(newPathsList)
        return newPathsList
    } catch (error) {
        if (error.message === `Paths array wasn't update`) {
            logger.info(`Paths array wasn't update`, {module: 'addPathToBase'})
            return ''
        }
        
        logger.error('addPathToBase ERROR: insert path -', {
            message: basePathWithoutRootDirectory,
            data: error.message,
            module: 'addPathToBase'
        })
        throwError(error.message, true)
    }
}

module.exports = {addPathToBase}
