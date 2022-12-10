const {logger} = require('../utils/logger')
const {difference} = require('ramda');

/**
 * Getting unused keywords from DB
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @return {string[]}
 */
const getUnusedKeywordsFromDB = async (req) => {
    const collection = req.app.locals.collection
    const configCollection = req.app.locals.configCollection;
    
    const mongoResponsePromise = collection
        .aggregate(
            [
                {
                    $group: {
                        _id: null,
                        keywordsSet: {$addToSet: '$keywords'},
                    }
                },
                {
                    $project: {
                        results: {
                            $reduce: {
                                input: {$concatArrays: '$keywordsSet'},
                                initialValue: [],
                                in: {$setUnion: ["$$value", "$$this"]}
                            }
                        }
                    }
                },
                {$unset: "_id"},
            ],
            {allowDiskUse: true})
        .toArray()
    
    const configResponsePromise = configCollection
        .aggregate([{$match: {name: {$eq: 'keywords'}}}])
        .toArray()
    
    const [mongoResponse, configResponse] = await Promise.all([mongoResponsePromise, configResponsePromise])
    return difference(configResponse[0].keywordsArr, mongoResponse[0].results)
}

/**
 * Getting unused keywords list
 *
 * @param {object} req - request object. Minimal: {
 *   app: {locals: {collection: null}},
 *   body: null
 * }
 * @param {object} res - response object. Minimal: {send: null}
 */
const getUnusedKeywordsRequest = async (req, res) => {
    try {
        const unusedKeywords = await getUnusedKeywordsFromDB(req)
        
        logger.http('GET-response', {message: '/unused-keywords', data: unusedKeywords})
        res.status(200).send(unusedKeywords)
    } catch
        (err) {
        logger.error("collection load error:", {message: err.message})
        res.status(500).send({message: `collection load error: ${err.message}`})
    }
}

module.exports = {getUnusedKeywordsRequest, getUnusedKeywordsFromDB}
