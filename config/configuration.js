const path = require('path');

module.exports = {
    log: {
        path: path.resolve(__dirname, 'D:/workspace/gitlab_canvas/image-server/logs'),
        level: 'debug',
    },
    route: {
        dirUrl: path.join(__dirname, '../controller')
    }
}