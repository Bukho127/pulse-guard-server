const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const compressionEnabled = process.env.ENABLE_VIDEO_COMPRESSION !== 'false';
const uploadsDir = path.resolve(__dirname, '../uploads');

//if the uploads folder does not exist,  Auto-create uploads folder so the server doesn't crash on start
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({ 
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
}); 

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

const compressVideo = (req, res, next) => {
    if (!req.file || !compressionEnabled) return next();

    const originalPath = req.file.path;
    const compressedFilename = `compressed-${req.file.filename.replace(path.extname(req.file.filename), '.mp4')}`;
    const compressedPath = path.join(uploadsDir, compressedFilename);

    const command = ffmpeg(originalPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .outputOptions([
            '-crf 28',
            '-preset ultrafast', 
            '-threads 0',   
            '-movflags frag_keyframe+empty_moov' 
        ])
        .format('mp4')
        .on('end', () => {
            try {
                const compressedStats = fs.statSync(compressedPath);

                if (fs.existsSync(originalPath)) {
                    fs.unlinkSync(originalPath);
                }

                req.file.path = compressedPath;
                req.file.destination = uploadsDir;
                req.file.filename = compressedFilename;
                req.file.originalname = path.parse(req.file.originalname).name + '.mp4';
                req.file.mimetype = 'video/mp4';
                req.file.size = compressedStats.size;

                next();
            } catch (err) {
                console.error('Failed finalizing compressed video:', err.message);
                next();
            }
        });

    command.on('error', (err) => {
        console.error('FFmpeg failed:', err.message);
        if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
        }
        next();
    });

    command.save(compressedPath);
};

module.exports = { upload, compressVideo };
