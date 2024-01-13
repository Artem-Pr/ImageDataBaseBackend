// const {DBController, DBRequests} = require('../../../utils/DBController');

const { uniq } = require("ramda")
const { removeExtraFirstSlash, getFilePathWithoutName, getUniqPaths } = require("../../../utils/common")

/**
* @param {object} DBCollection
* @param {object[]} conditionArr
* @returns {Promise<string[]>}
*/
const getDynamicFoldersArr = async (DBCollection, conditionArr) => {
    const filePathListResponse = [
        {$project: {"filePath": 1}}, // includes only the filePath field in the resulting documents
        {
            $group: {
                _id: null,
                filePathSet: {$addToSet: '$filePath'}, // creates a set of unique file paths
            }
        },
        {$unset: ["_id", "items"]}, // removes the _id field and the items field (if it exists) from the resulting documents
    ]
    
    const returningObject = {
        $facet: {
            response: filePathListResponse
        }
    }
    
    const aggregation = conditionArr.length ? [
        {$match: {$and: conditionArr}},
        returningObject
    ] : [returningObject]
    
    const [mongoResponse] = await DBCollection
        .aggregate(aggregation, {allowDiskUse: true})
        .toArray()
    
    const resultsWithSubfolders = getUniqPaths(uniq(
        mongoResponse.response[0].filePathSet.map(filePath => {
            return getFilePathWithoutName(removeExtraFirstSlash(filePath))
        })
    ))

    return resultsWithSubfolders
}

module.exports = {getDynamicFoldersArr}