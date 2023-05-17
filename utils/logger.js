const {addColors, config, createLogger, format, transports} = require('winston')
const {combine, timestamp, printf} = format;

const myFormat = printf(({level, message, data, module, timestamp}) => {
    return `${timestamp} ${level}: ${message} ${data ? JSON.stringify(data, null, 2) : ''} ${module ? JSON.stringify(module, null, 2) : ''}`;
});

const loggerFormat = combine(
    timestamp(),
    myFormat
)
const simpleLoggerFormat = combine(
    format.colorize(),
    myFormat,
    format.simple()
)
const transportsConfig = {
    maxsize: 10000000,
    maxFiles: 5,
    format: loggerFormat,
}
const colorsConfig = {
    ...config.npm.colors,
    http: 'cyan', // Magenta
}

const logger = createLogger({
    transports: [
        new transports.File({...transportsConfig, filename: 'logger/error.log', level: 'error'}),
        new transports.File({...transportsConfig, filename: 'logger/combined.log', level: 'silly'}),
    ],
    exceptionHandlers: [
        new transports.File({...transportsConfig, filename: 'logger/exceptions.log'})
    ],
    rejectionHandlers: [
        new transports.File({...transportsConfig, filename: 'logger/rejections.log'})
    ]
});

addColors(colorsConfig)

if (process.env.NODE_ENV !== 'production') {
    const console = new transports.Console({format: simpleLoggerFormat, level: 'silly'})
    // const http = new transports.Http({format: simpleLoggerFormat, host: 'localhost', port: 8080})
    
    logger
        .add(console)
    // .add(http)
}

module.exports = {logger}
