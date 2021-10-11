/**
 * @param req
 * @param {string} basePathWithoutRootDirectory
 * @return {Promise<string>} basePathWithoutRootDirectory or '' if this directory is exists
 */
const addPathToBase = async (req, basePathWithoutRootDirectory) => {
    const configCollection = req.app.locals.configCollection;
    try {
        const response = await configCollection.findOne({name: "paths"})
        
        if (!response) {
            await configCollection.insertOne({name: "paths", pathsArr: [basePathWithoutRootDirectory]})
            console.log(`ADD path "${basePathWithoutRootDirectory}" to config`)
            return basePathWithoutRootDirectory
        }
        
        const pathsSet = new Set(response.pathsArr)
        if (pathsSet.has(basePathWithoutRootDirectory)) return ''
        
        pathsSet.add(basePathWithoutRootDirectory)
        pathsSet.delete('')
        const newPathsArr = Array.from(pathsSet).sort()
        
        await configCollection.updateOne({name: "paths"}, {$set: {pathsArr: newPathsArr}})
        console.log(`ADD PATH "${basePathWithoutRootDirectory}" to config`)
        return basePathWithoutRootDirectory
    } catch (error) {
        console.log(`addPathToBase ERROR: insert path - ${basePathWithoutRootDirectory}`, error)
        throw new Error(`addPathToBase ERROR: insert path - ${basePathWithoutRootDirectory}, ${error}`)
    }
}

module.exports = {addPathToBase}
