const fs = require('fs-extra')
const convert = require('heic-convert');
const {changeExtension} = require('./common');
const {UPLOAD_TEMP_FOLDER} = require('../constants');

const bom = {
  fieldname: 'filedata',
  originalname: 'IMG_6649.heic',
  encoding: '7bit',
  mimetype: 'image/heic',
  destination: 'uploadTemp',
  filename: '432565c831a666f18a1fab4257740ea6',
  path: 'uploadTemp/432565c831a666f18a1fab4257740ea6',
  size: 2298618
}

/**
 * @param {{
 * fieldname: 'filedata',
 * originalname: string,
 * encoding: string,
 * mimetype: string,
 * destination: string,
 * filename: string,
 * path: string,
 * size: number
 * }} filedata - image Blob or DB object
 */
const heicToJpegFile = async (filedata) => {
  // const blob = await heic2any({
  //   blob: file,
  //   toType: 'image/jpeg',
  //   quality: 0.9,
  // })
  
  console.log('filedata-----------', filedata)
  console.log('filePath-----------', `${UPLOAD_TEMP_FOLDER}/${filedata.filename}`)
  const fileBuffer = await fs.readFile(`${UPLOAD_TEMP_FOLDER}/${filedata.filename}`)
  console.log('fileBuffer ---------', Buffer.from(fileBuffer))
  const blob = await convert({
    buffer: fileBuffer, // the HEIC file buffer
    format: 'JPEG',      // output format
    quality: 0.9           // the jpeg compression quality, between 0 and 1
  });
  
  console.log('blob--------', blob)

  // return new File(Array.isArray(blob) ? blob : [blob], changeExtension(filedata.name, 'jpg'), {
  //   lastModified: file.lastModified,
  //   type: 'image/jpeg',
  // })
}

module.exports = {
  heicToJpegFile
}
