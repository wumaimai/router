const isInteger = exports.isInteger = num => {
    return /^[-+]?\d+$/.test(num) && typeof num == 'number';
}
const isNotInteger = exports.isInteger = num => {
    return !isInteger(num);
}
const isCompleteDate = exports.isCompleteDate = date => {
    return /^[12][0-9]{3}-(([0][1-9])|([1][0-2]))-[0-3]\d( [0-2]\d:[0-5]\d:[0-5]\d)?$/.test(date);
}
const isNotCompleteDate = exports.isCompleteDate = date => {
    return !isCompleteDate(date);
}
const isUndefined = exports.isUndefined = variable => {
    return typeof variable === 'undefined';
}
const isNotUndefined = exports.isUndefined = variable => {
    return !isUndefined(variable);
}
const isEmpty = exports.isEmpty = variable => {
    return variable == null || variable === undefined || variable === '';
}
const isNotEmpty = exports.isNotEmpty = variable => {
    return !isEmpty(variable)
}
const isFalse = exports.isFalse = variable => {
    if (typeof variable == 'string') {
        variable = variable.replace(/\s/g, '')
    }
    return (isEmpty(variable) || variable == false || variable == 0);
}
const isNotFalse = exports.isNotFalse = variable => {
    return !isFalse(variable);
}
const isEmail = exports.isEmail = email => {
    return /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/.test(email);
}
const isPhone = exports.isPhone = email => {
    return /^((\+86)|(86))?(1)[3458][0-9]{9}$|^0\d{2,3}-?\d{7,8}$/.test(email);
}
const isHttp = exports.isHttp = variable => {
    return /^((ht|f)tps?):\/\/[\w\-]+(\.[\w\-]+)+([\w\-\.,@?^=%&:\/~\+#\u4e00-\u9fa5]*[\w\-\@?^=%&\/~\+#\u4e00-\u9fa5])?$/.test(variable)
}
const isNotHttp = exports.isNotHttp = variable => {
    return !isHttp(variable)
}

/**
 * um账号
 */
const isUm = exports.isUm = um => {
    return /^[a-zA-Z]{2,20}\d{3}$/.test(um);
}
const isNotUm = exports.isNotUm = um => {
    return !isUm(um);
}

const numberConvertDate = exports.numberConvertDate = (type, value) => {
    if(type == 1) { // 数字型转换日期格式
		var value = value + "";
		return value.length == 8 ? value.substring(4, 6) + "-" + value.substring(6, 8) : "";
	} else if(type == 2) { // 数字型转换成时间
		var h = Math.floor(value / 60); // 时
		if(h < 10) {h = "0" + h;}
		var m = Number(value % 60); // 分
		if(m < 10) {m = "0" + m;}
		return h + ":" + m;
	}
	return "";
}

export default {
    isInteger,
    isNotInteger,
    isCompleteDate,
    isNotCompleteDate,
    isUndefined,
    isNotUndefined,
    isEmpty,
    isNotEmpty,
    isFalse,
    isNotFalse,
    isEmail,
    isPhone,
    isUm,
    isNotUm,
    isHttp,
    isNotHttp,
    numberConvertDate
}