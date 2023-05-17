const multer = require("multer")

const getMulterSettings = (tempFolder) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, tempFolder)
        },
    })
    
    return multer({storage: storage})
}

module.exports = {getMulterSettings}
