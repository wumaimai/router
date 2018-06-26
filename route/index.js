const path = require('path');
const fs = require('fs');
const router = require('express').Router();
const isUndefined = require('../lib/validate').isUndefined;

//资源管理器
function _explorer(cpath){
    let _file = [];
    try{
        fs.readdirSync(cpath).forEach((item, index) => {
            let _path = path.join(cpath, item);
            console.log(_path);
            try{
                let _statInfo = fs.statSync(_path);
                if(_statInfo.isDirectory())
                {
                    _file.push(..._explorer(_path));
                }
                else
                {
                    _file.push(require(_path));
                }
            }
            catch(e){
                logger.error('文件导入失败：' + e);
            }
        });
    }
    catch(e){
        logger.info(`读取route指定的目录文件异常：${e}`);
    }
    return _file;
}

/**
 * 补齐path
 *
 * @param {any} path
 * @returns
 */
function _validatePath(path) {
    path = path.replace("\\", "\/");
    if (path.indexOf('\\') > 0){
        path = _validatePath(path);
    }
    return path;
}

const defineRoute = function(){
    _explorer(config.route.dirUrl).forEach(function(item, index){
        //开始填充router
        for(let key in item){
            let _class = item[key];
            if(_class && _class.isRoute)
            {
                for(let key in _class){
                    let reqOtp = _class[key];
                    if( typeof reqOtp == 'function' ){
                        let { reqType, reqPath } = reqOtp,
                            routePath = path.join(_class.path, reqPath);
                        router[reqType](_validatePath(routePath), function(req, res, next){
                            reqOtp(req, res, next);
                            next();
                        });
                    }
                }
            }
        }
    }); 
}

defineRoute();

module.exports = router;