import sharp from "sharp";

export const uploadItemRequest = (req, res) => {
	let filedata = req.file;
	if (!filedata) res.send("Ошибка при загрузке файла");
	console.log('filedata', filedata);
	
	sharp(filedata.path)
		.withMetadata()
		.clone()
		.resize(200)
		.jpeg({ quality: 80 })
		.toFile(filedata.path + '-preview.jpg')
		.then(() => {
			const photoProps = {
				preview: 'http://localhost:5000/images/' + filedata.filename + '-preview.jpg',
				tempPath: filedata.path,
			}
			res.send(photoProps)
		})
		.catch( err => console.log('err', err));
}