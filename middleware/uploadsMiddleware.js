const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.resolve(__dirname, '../uploads');

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
        const allowedMimeTypes = [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'), false);
        }
    }
});

// Validates the file exists after multer, then rewrites the path to the
// container-internal mount path so the Go worker can find the file on the shared volume.
const validateUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Video file is required' });
    }

    // Multer gives us the host-relative path e.g. /home/user/project/uploads/123-video.mp4
    // Go sees the same volume mounted at /app/uploads, so rewrite to container path.
    req.file.containerPath = `/app/uploads/${path.basename(req.file.path)}`;

    next();
};

module.exports = { upload, validateUpload };