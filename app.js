const express = require("express");
const path = require("path");
const multer = require("multer");
var upload = multer({ dest: "uploads/" });
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const fs = require("fs");
// var mongo = require("mongodb");
const MongoClient = require("mongodb").MongoClient;
var mongoose = require("mongoose");
var Grid = require("gridfs-stream");
const cors = require("cors");
const app = express();

app.use(cors());

app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(multer({ dest: "./uploads/" }).single("filedata"));
// app.use(
// 	multer({
// 		dest: "./uploads/",
// 		rename: function (fieldname, filename) {
// 			return filename.replace(/\W+/g, "-").toLowerCase() + Date.now();
// 		},
// 		onFileUploadStart: function (file) {
// 			console.log(file.fieldname + " is starting ...");
// 		},
// 		onFileUploadData: function (file, data) {
// 			console.log(data.length + " of " + file.fieldname + " arrived");
// 		},
// 		onFileUploadComplete: function (file) {
// 			console.log(file.fieldname + " uploaded to  " + file.path);
// 		},
// 	})
// )

const mongoClient = new MongoClient("mongodb://localhost:27017/", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

app.post("/upload", upload.array("filedata"), function (req, res) {
  let filedata = req.files;
  console.log("filedata", filedata);
  console.log("body", req);
  if (!filedata) res.send("Ошибка при загрузке файла");
  else res.send("Файл загружен");

  mongoClient.connect((err, client) => {
    if (err) {
      console.log("Connection error: ", err);
      throw err;
    }
    console.log("Connected");

    const db = client.db("IDB");
    const collection = db.collection("photos");
    collection.insertMany(filedata, function (err, result) {
      if (err) {
        return console.log("collection insert error", err);
      }
      console.log(result);
      client.close();
    });
  });
});

app.use(function (err, req, res, next) {
  console.log("This is the invalid field ->", err.field);
  next(err);
});

const port = 5000;

app.listen(port, function () {
  console.log("Start listerning on port " + port);
});
