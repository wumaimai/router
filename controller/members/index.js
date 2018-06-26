import { Controller, Get } from '../../lib/common/decorate'

@Controller('/members')
export class A {
    @Get('/a')
    async funcA(req, res, next){
        logger.info('当然有区别啦！');
        return res.sendSuccess();
    }
};



