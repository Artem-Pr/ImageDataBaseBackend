const sharp = require("sharp")
const ThumbnailGenerator = require('video-thumbnail-generator').default

const uploadItemRequest = (req, res) => {
	let filedata = req.file
	if (!filedata) res.send("Ошибка при загрузке файла")
	
	if (filedata.mimetype.startsWith('video')) {
		const tg = new ThumbnailGenerator({
			sourcePath: filedata.path,
			thumbnailPath: 'temp/',
		});
		
		tg.generate({
			percent: 1,
			count: 1,
			size: '1000x?'
		})
			.then((preview) => {
				console.log('video-preview', preview)
				const photoProps = {
					preview: 'http://localhost:5000/images/' + preview[0],
					tempPath: filedata.path,
				}
				res.send(photoProps)
			})
			.catch(err => console.log('err', err));
		
	} else {
		sharp(filedata.path)
			.withMetadata()
			.clone()
			.resize(200)
			.jpeg({quality: 80})
			.toFile(filedata.path + '-preview.jpg')
			.then(() => {
				const photoProps = {
					preview: 'http://localhost:5000/images/' + filedata.filename + '-preview.jpg',
					tempPath: filedata.path,
				}
				console.log('sharp SUCCESS', filedata.originalname)
				res.send(photoProps)
			})
			.catch(err => console.log('err', err));
	}
}

module.exports = {uploadItemRequest}
