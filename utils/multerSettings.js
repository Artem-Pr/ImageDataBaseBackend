import multer from "multer";

export const getMulterSettings = (tempFolder) => {
	const storage = multer.diskStorage({
		destination: function (req, file, cb) {
			// fs.mkdirsSync(req.headers.path);
			// cb(null, req.headers.path)
			cb(null, tempFolder)
		},
		// filename: function (req, file, cb) {
		//     console.log("file-----", file)
		//     console.log("req-----", req)
		//     cb(null, file.originalname)
		// }
	})
	
	return multer({storage: storage})
}