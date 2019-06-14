const express = require('express')
const app = express()
const path = require('path')
const multer = require('multer')
const upload = multer({
    dest: 'uploads'
})
const fs = require('fs')
const s3 = require('s3')
const port = process.env.PORT || 3000

const s3Config = {
    accessKeyId: process.env.S3_ACCESS_KEY || 'AKIAIKXRA3BNG3QXU54Q',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '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',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'testecursp'
}

const dbSettings = {
    hostname: process.env.RDS_HOSTNAME || '127.0.0.1',
    port: process.env.RDS_PORT || '3306',
    dbName: process.env.RDS_DB_NAME || 'arquivos',
    username: process.env.RDS_USERNAME || 'guile',
    password: process.env.RDS_PASSWORD || '#Guile1981'
}
const Sequelize = require('sequelize')
const sequelize = new Sequelize(dbSettings.dbName, dbSettings.username, dbSettings.password, {
    dialect: 'mysql',
    host: dbSettings.hostname
})
const Arquivo = sequelize.define('Arquivo', {
    name: Sequelize.STRING
})

const client = s3.createClient({
    s3Options: s3Config
})

const aws = require('aws-sdk')
aws.config = new aws.Config(s3Config)
const s3SDK = new aws.S3()

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('/', async(req, res) => {
    const arquivos = await Arquivo.findAll()
    res.render('index', { arquivos })
})
app.get('/ver/:id', async(req, res) => {
    const arquivo = await Arquivo.findByPk(req.params.id)
    const s3File = {
        Bucket: s3Config.bucket,
        Key: arquivo.name,
        Expires: 20,
    }
   const signedUrl = s3SDK.getSignedUrl('getObject', s3File)
    res.redirect(signedUrl)
})

const uploadToS3 = (file, key, mimetype, s3Config) => {
    const params = {
        localFile: file,
        s3Params: {
            Bucket: s3Config.bucket,
            Key: key,
            ContentType: mimetype,
        }
    }
    return new Promise((resolve, reject) => {
        const uploader = client.uploadFile(params)
        uploader.on('end', () => {
            resolve()
        })
    })
}

const removeFile = (file) => {
    return new Promise((resolve, reject) => {
        fs.unlink(file, (err) => {
            if(err){
                reject(err)
            }else{
                resolve()
            }
        })
    })
}

app.post('/upload', upload.single('foto'), async(req, res) => {
    await uploadToS3(req.file.path, req.file.originalname, req.file.mimetype, s3Config)
    await removeFile(req.file.path)
    const arquivo = await Arquivo.create({
        name: req.file.originalname
    })
    res.redirect('/')
})

sequelize.sync().then(() => {
    app.listen(port, () => console.log('running...'))
})