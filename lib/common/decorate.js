export const Controller = function(_path){
    return function(target){
        target.prototype.path = _path;
        target.prototype.isRoute = true;
        target.prototype.identity = 'controller';
        return new target();
    }
}

const reqType = ['Get', 'Post'];
for(let v of reqType){
    exports[v] = (_path = '/') => {
        return (target, name, descriptor) => {
            let method = descriptor.value;
            descriptor.value = function(req, res, next){
                logger.info('聪明的小孩和笨小孩有没有什么区别呀？');
                res.sendSuccess = (results = '操作成功', status = 1) => {
                    res.send({
                        status,
                        results
                    });
                    res.end();
                };
                return method.apply(this, arguments);
            }
            descriptor.value.reqType = v.toLocaleLowerCase();
            descriptor.value.reqPath = _path;
            descriptor.enumerable = true;
            return descriptor;
        }
    }
}


