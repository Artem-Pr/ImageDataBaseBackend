const PORT = 5000
const TEMP_FOLDER = 'temp'
const UPLOAD_TEMP_FOLDER = 'uploadTemp'

// static folders
const DATABASE_FOLDER_NAME = 'dataBase'
const IMAGES_TEMP_FOLDER = 'images'
const UPLOAD_IMAGES_TEMP_FOLDER = 'upload_images'

const DATABASE_FOLDER = '/app/' + DATABASE_FOLDER_NAME // docker mode
// const DATABASE_FOLDER = __dirname + '/' + DATABASE_FOLDER_NAME // local mode

const MONGO_HOST_NAME = 'mongo-dev' // docker dev
// const MONGO_HOST_NAME = 'mongo-test' // docker test
// const MONGO_HOST_NAME = 'mongo' // docker
// const MONGO_HOST_NAME = 'localhost' // local

const VIDEO_EXTENSION_LIST = ['mkv', 'flv', 'avi', 'mov', 'wmv', 'mp4', 'm4p', 'm4v', 'mpg', 'mp2', 'mpeg', 'm2v', '3gp']

module.exports = {
    PORT,
    TEMP_FOLDER,
    UPLOAD_TEMP_FOLDER,
    
    DATABASE_FOLDER_NAME,
    IMAGES_TEMP_FOLDER,
    UPLOAD_IMAGES_TEMP_FOLDER,
    
    DATABASE_FOLDER,
    MONGO_HOST_NAME,
    
    VIDEO_EXTENSION_LIST,
}
