/**
 * canvas画图
 */
define(function(require, exports, module) {
	var common = require("common");
	var gconfig = $.config;
	var global = gconfig.global;
	var _pageId = null; // 当前页面的pageId
	var strokeColor = "#DDDDDD"; // 框线颜色值
	var riseColor = "#DC0000"; // 涨的色值
	var fallColor = "#32a632"; // 跌的色值
	var fontColor = "#999999"; // 字体颜色值 也表示不涨的色值 十字架色值
	//var dashedLineColor = "#1CAA3D"; // 虚线颜色值
	var dashedLineColor = "#DDDDDD";
	var averColor = "#FF7F00"; // 均线颜色值
	var currColor = "#36A2F1"; // 价格线与由价格线产生的封闭框的颜色值
	var ma5Color = "#D800FF"; // ma5指标线颜色值
	var ma10Color = "#DCC000"; // ma10指标线颜色值
	var ma20Color = "#00B4FF"; // ma20指标线颜色值
	var ma60Color = "#4AE000"; // ma60指标线颜色值
	var backgroundFillColor = "#E2EAEE"; // 十字架产生的移动框背景色值
	var globalAlpha = 0.1; // 价格线产生的封闭框色值的透明度
	var fontStyle = "20px Arial"; // 字体样式
	var lineWidth = 2; // 线的宽度默认为1 因为canvas在手机上高宽乘以了2，所以需要将线宽默认值改为2
	var volHeight = null; // 行情图下部分的高度，也是画图的高度
	var minHeight = null; // 行情图上部分的高度
	var minPaddingHeight = null; // 行情图上部分的上下内边距 将线图与边框隔些距离
	var minCanvasHeight = null; // 行情图上部分的画图的高度
	var canvasWidth = null; // canvas画图的宽度
	var canvasHeight = null; // canvas画图的高度
	var results = null; // 接口查询数据
	var stock = null; // 最新盘口数据
	var count = null; // K线图中蜡烛满屏时的个数
	var historyLoadCount = 0; // 历史加载K线数量 即屏幕上最后一个点到今天之间的数据点个数
	var diff = [], dea = [], macd = []; // DIFF、DEA、MACD指标集合
	var up = [], mb = [], dn = []; // 上、中、下轨线指标集合
	var kdj_k = [], kdj_d = [], kdj_j = []; // KDJ指标中K、D、J线集合

	function frameFunc() { // 搭建canvas画图的架子
		_pageId = "#" + $.getCurrentPageObj().pageId + " ";
		count = Math.floor(($(_pageId + "#crux")[0].clientWidth + global.hqKLineSpace) / (global.hqKLineSpace * 4)); // 保存K线满屏时蜡烛的个数
		var frameCanvas = $(_pageId + "#frame canvas")[0];
		if(frameCanvas) { // 框架canvas
			var canvas = $(_pageId + ".stock_chart canvas"); // 获取canvas对象
//			canvas.attr("height", canvas.height() * 2); // 横屏之前的写法，横屏页面的宽高互换了，固用获取宽高的方法与实际宽高相反
//			canvas.attr("width", canvas.width() * 2);
			canvas.attr("height", $(_pageId + "#crux")[0].clientHeight * 2); // 需给canvas设置必须样式height、width 这里获取移动十字架的div宽高是因为当进入横屏页面时若为盘口则其它的canvas都被隐藏了，无高宽
			canvas.attr("width", $(_pageId + "#crux")[0].clientWidth * 2); // 否则默认画布大小为宽300，高150 高宽乘以2是为了处理canvas画图在手机浏览器模糊不清的问题
			canvasWidth = frameCanvas.width; // canvas画图的宽度
			canvasHeight = frameCanvas.height; // canvas画图的高度
			minHeight = canvasHeight * 0.75; // 总canvas高度的75%
			minPaddingHeight = canvasHeight * 0.025; // 上下边距各占2.5%的高度
			minCanvasHeight = canvasHeight * 0.7; // 行情图上部分占70%的高度，剩余5%给时间数字
			volHeight = canvasHeight * 0.25; // 行情图下部分占25%的高度
//			if(!jqCanvasNode.attr("isDraw")) { // 判断对象是否存在以及是否画过 在纵横屏切换时上面的值需要重新计算
//			}
			var ctx = frameCanvas.getContext('2d'); // 获取画布
			ctx.strokeStyle = strokeColor; // 定义框架线颜色样式
			ctx.strokeRect(0, 0, isInteger(canvasWidth), isInteger(minCanvasHeight)); // 行情图上部分方框线 .5的作用是处理边框线粗细不均
			ctx.strokeRect(0, isInteger(minHeight) + 1, isInteger(canvasWidth), isInteger(volHeight)); // 行情图下部分方框线  y起点加1是处理毛边的问题
			ctx.moveTo(0, isInteger(minPaddingHeight)); // 上限制水平线的开始点
			ctx.lineTo(canvasWidth, isInteger(minPaddingHeight)); // 上限制水平线的结束点
			ctx.moveTo(0, isInteger(minCanvasHeight - minPaddingHeight)); // 下限制水平线的开始点
			ctx.lineTo(canvasWidth, isInteger(minCanvasHeight - minPaddingHeight)); // 下限制水平线的结束点
			ctx.stroke();
//			jqCanvasNode.attr("isDraw", "true"); // 避免下次进入页面再画框架线
		}
	}

	/**
	 * 行情图分时画法
	 * @param results 分时历史数据
	 * @param stock 当前、实时数据
	 * 定义canvas对象-画框线-绘制时刻字-绘制均线-绘制价格线-绘制成交量图-绘制价格封闭框-绘制价格涨跌幅字
	 * */
	function minLineFunc(_results, _stock) {
		results = _results;
		stock = _stock;
		var minCanvas = $(_pageId + "#min canvas")[0];
		if(minCanvas) { // 分时canvas对象
			var ctx = minCanvas.getContext('2d'); // 获取画布
			ctx.save(); // 保存当前画布 避免下次绘制时本次给canvas标签增加的样式影响其效果
			ctx.font = fontStyle; // 定义字体样式
			ctx.fillStyle = fontColor; // 定义字体颜色样式
			if(stock.market == "HK" || stock.stockType == 99) { // 判断是否为港股通
				lineFunc(minCanvas, 5, 4); // 获取分时线条canvas
				ctx.textAlign = "left";
				ctx.fillText("9:30", 0, minHeight);
				ctx.textAlign = "center";
				ctx.fillText("12:00/13:00", canvasWidth * 0.5, minHeight);
				ctx.textAlign = "right";
				ctx.fillText("16:00", canvasWidth, minHeight);
			} else {
				lineFunc(minCanvas, 4, 4); // 获取分时线条canvas
				ctx.textAlign = "left";
				ctx.fillText("9:30", 0, minHeight);
				ctx.textAlign = "center";
				ctx.fillText("10:30", canvasWidth * 0.25, minHeight);
				ctx.fillText("11:30/13:00", canvasWidth * 0.5, minHeight);
				ctx.fillText("14:00", canvasWidth * 0.75, minHeight);
				ctx.textAlign = "right";
				ctx.fillText("15:00", canvasWidth, minHeight);
			}
			minFiveLineFunc("min", ctx); // 分时五日均线、价格线、成交量线画法
			ctx.restore(); // 取出之前保存的画布 与save对应
		}
	}

	function fiveLineFunc(_results, _stock) { // 行情图五日画法
		results = _results;
		stock = _stock;
		var fiveCanvas = $(_pageId + "#five canvas")[0];
		lineFunc(fiveCanvas, 5, 4); // 获取五日线条canvas
		if(fiveCanvas && results.length > 0) { // 分时canvas对象 并且有数据
			var minCount = (stock.market == "HK" || stock.stockType == 99) ? 67 : 61; // 五日分时一日点数 港股通五日335个点 A股305
			var ctx = fiveCanvas.getContext('2d'); // 获取画布
			ctx.save(); // 保存当前画布 避免下次绘制时本次给canvas标签增加的样式影响其效果
			ctx.textAlign = "center";
			ctx.font = fontStyle; // 定义字体样式
			ctx.fillStyle = fontColor; // 定义字体颜色样式
			ctx.fillText(numberConvertDate(1, results[0].date), canvasWidth * 0.1, minHeight); // 五日第一日
			if(results.length > minCount) { // 五日第二日
				ctx.fillText(numberConvertDate(1, results[minCount].date), canvasWidth * 0.3, minHeight); // 五日第二日
			} else if(stock.isSuspend == 1 && results.length == minCount) { // 今日停牌，服务器不返回今日数据
				ctx.fillText(numberConvertDate(1, window.hvDate), canvasWidth * 0.3, minHeight); // 五日第二日
			}
			if(results.length > minCount * 2) { // 五日第三日
				ctx.fillText(numberConvertDate(1, results[minCount * 2].date), canvasWidth * 0.5, minHeight); // 五日第三日
			} else if(stock.isSuspend == 1 && results.length == minCount * 2) { // 今日停牌，服务器不返回今日数据
				ctx.fillText(numberConvertDate(1, window.hvDate), canvasWidth * 0.5, minHeight); // 五日第三日
			}
			if(results.length > minCount * 3) { // 五日第四日
				ctx.fillText(numberConvertDate(1, results[minCount * 3].date), canvasWidth * 0.7, minHeight); // 五日第四日
			} else if(stock.isSuspend == 1 && results.length == minCount * 3) { // 今日停牌，服务器不返回今日数据
				ctx.fillText(numberConvertDate(1, window.hvDate), canvasWidth * 0.7, minHeight); // 五日第四日
			}
			if(results.length > minCount * 4) { // 五日第五日
				ctx.fillText(numberConvertDate(1, results[minCount * 4].date), canvasWidth * 0.9, minHeight); // 五日第五日
			} else if(stock.isSuspend == 1 && results.length == minCount * 4) { // 今日停牌，服务器不返回今日数据
				ctx.fillText(numberConvertDate(1, window.hvDate), canvasWidth * 0.9, minHeight); // 五日第五日
			}
			minFiveLineFunc("five", ctx); // 分时五日均线、价格线、成交量线画法
			ctx.restore(); // 取出之前保存的画布 与save对应
		}
	}

	function minFiveLineFunc(type, ctx) { // 分时五日均线、价格线、成交量线画法 ctx为画布对象 type表示分时、五日类型
		if(results.length > 0) {
			var prec = (type == "min" ? stock.prec : results[0].prec); // 昨收 五日分时取五日第一日的昨收值
			if(stock.market == "HK" || stock.stockType == 99) { // 判断是否为港股通
				var space = (type == "min" ? (canvasWidth - 2) / (332 - 1) : (canvasWidth - 2) / (335 - 1)); // 港股通分时有330个点 五日分时一日点每4个一点
			} else {
				var space = (type == "min" ? (canvasWidth - 2) / (242 - 1) : (canvasWidth - 2) / (305 - 1));
			}
			
			var point = common.typePoint(stock.stockType); // 股票类型判断位数
			var maxMinDiff = 0; // 差值 确定上下限值
			var maxVol = 0; // 确定成交量最大值
			for (var i = 0; i < results.length; i++) { // 获取最大成交量值和最大价格与昨收的差值
				var volue = Math.abs(results[i].currPrice - prec); // 获取每分钟价格与昨收的差值
				maxMinDiff = (maxMinDiff < volue) ? volue : maxMinDiff; // 确定最大差值
				maxVol = (maxVol < results[i].volume) ? results[i].volume : maxVol;
			}
			var maxUppercent = maxMinDiff / prec; // 最大涨跌幅
			if(maxMinDiff == 0) { // 停牌或最大差值为0 此时画一条停牌均线即可
				maxUppercent = 0.02; // 停牌时默认涨幅上下限为2%
				maxMinDiff = prec * maxUppercent; // 停牌上下限值
				ctx.beginPath();
				ctx.strokeStyle = averColor; // 均线色值
				ctx.lineWidth = lineWidth; // 设置线宽
				ctx.moveTo(0, isInteger(minCanvasHeight * 0.5));
				ctx.lineTo(space * (results.length - 1) + 1, isInteger(minCanvasHeight * 0.5));
				ctx.stroke();
				ctx.fillStyle = currColor; // 价格线封闭的框色值
				ctx.globalAlpha = globalAlpha; // 价格线封闭的透明度
				ctx.fillRect(0, minCanvasHeight * 0.5, space * (results.length - 1) + 1, minCanvasHeight * 0.5); // 绘制价格封闭框
				ctx.restore(); // 取出之前保存的画布 与save对应
			} else {
				ctx.beginPath();
				ctx.strokeStyle = averColor; // 均线色值
				ctx.lineWidth = lineWidth; // 设置线宽
				for (var i = 0; i < results.length; i++) { // 绘制均线
					var x = space * i + 1; // 加上边框线占的宽度
					var y = (maxMinDiff + prec - results[i].averPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
					i == 0 ? ctx.moveTo(isInteger(x), minPaddingHeight + isInteger(y)) : ctx.lineTo(isInteger(x), minPaddingHeight + isInteger(y));
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = currColor; // 价格线色值
				for (var i = 0; i < results.length; i++) { // 绘制价格线
					var x = space * i + 1; // 加上边框线占的宽度
					var y = (maxMinDiff + prec - results[i].currPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
					i == 0 ? ctx.moveTo(isInteger(x), minPaddingHeight + isInteger(y)) : ctx.lineTo(isInteger(x), minPaddingHeight + isInteger(y));
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.fillStyle = currColor; 
				var x = space * (results.length - 1) + 1; // 加上边框线占的宽度
				var y = (maxMinDiff + prec - results[results.length - 1].currPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
				ctx.arc(isInteger(x), minPaddingHeight + isInteger(y), 5, 0, 2 * Math.PI); // 绘制最后一个价格点的圆
				ctx.fill();
				for (var i = 0; i < results.length; i++) { // 绘制成交量线
					var val = i == 0 ? prec : results[i - 1].currPrice;
					var volColor = (results[i].currPrice - val) > 0 ? riseColor : ((results[i].currPrice - val) < 0 ? fallColor : fontColor);
					ctx.beginPath();
					ctx.strokeStyle = volColor; // 价格线色值
					var x = space * i + 1; // 加上边框线占的宽度
					var y = results[i].volume / maxVol * volHeight;
					ctx.moveTo(isInteger(x), canvasHeight - y);
					ctx.lineTo(isInteger(x), canvasHeight);
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.strokeStyle = currColor; // 价格线色值
				ctx.lineWidth = lineWidth * 2; // 设置线宽
				ctx.globalAlpha = globalAlpha; // 价格线封闭的透明度
				for (var i = 0; i < results.length; i++) { // 绘制价格线产生的封闭框
					var x = space * i + 1; // 加上边框线占的宽度
					var y = (maxMinDiff + prec - results[i].currPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
					ctx.moveTo(isInteger(x), minPaddingHeight + y);
					ctx.lineTo(isInteger(x), minCanvasHeight);
				}
				ctx.stroke();
				/**
				 * 说明：最新状态，服务器就算停牌也会返回图点数据
				 * 时间：2016年3月3日13:50:54
				 * */
				/*if(type == "five" && stock.isSuspend == 1) { // 股票停牌时，五日不返回今日数据，需补齐
					ctx.beginPath();
					ctx.strokeStyle = averColor; // 均线色值
					ctx.lineWidth = lineWidth; // 设置线宽
					ctx.globalAlpha = 1; // 价格线封闭的透明度
					var x = space * (results.length - 1) + 1;
					var y = (maxMinDiff + prec - results[results.length - 1].currPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
					ctx.moveTo(x, minPaddingHeight + isInteger(y));
					ctx.lineTo(canvasWidth, minPaddingHeight + isInteger(y));
					ctx.stroke();
					ctx.beginPath();
					ctx.fillStyle = currColor; // 价格线封闭的框色值
					ctx.globalAlpha = globalAlpha; // 价格线封闭的透明度
					ctx.fillRect(x, minPaddingHeight + y, canvasWidth - x, minCanvasHeight - minPaddingHeight - y); // 绘制价格封闭框
				}*/
				ctx.restore(); // 取出之前保存的画布 与save对应
			}
			ctx.textAlign = "left";
			ctx.font = fontStyle; // 定义字体样式
			ctx.fillStyle = riseColor; // 大于昨收的色值
			ctx.fillText((prec + maxMinDiff).toFixed(point), 0, minPaddingHeight + 16);
			ctx.fillStyle = fontColor; // 定义字体颜色样式
			ctx.fillText(prec.toFixed(point), 0, minCanvasHeight * 0.5 + 6);
			ctx.fillStyle = fallColor; // 小于昨收的色值
			ctx.fillText((prec - maxMinDiff).toFixed(point), 0, minCanvasHeight - minPaddingHeight - 3);
			ctx.textAlign = "right";
			ctx.fillStyle = riseColor; // 大于昨收的色值
			ctx.fillText((maxUppercent * 100).toFixed(2) + "%", canvasWidth, minPaddingHeight + 16);
			ctx.fillStyle = fontColor; // 定义字体颜色样式
			ctx.fillText("0.00%", canvasWidth, minCanvasHeight * 0.5 + 6);
			ctx.fillStyle = fallColor; // 小于昨收的色值
			ctx.fillText("-" + (maxUppercent * 100).toFixed(2) + "%", canvasWidth, minCanvasHeight - minPaddingHeight - 3);
		}
	}

	function KLineFunc(_results, _stock, type, targetType, _historyLoadCount) { // 画K线图方法 type为K线类型 表示日K、周K、月K targetType指标类型 历史加载点数
		stock = _stock;
		historyLoadCount = _historyLoadCount;
		var KLineCanvas = $(_pageId + "#" + type + " canvas")[0];
		lineFunc(KLineCanvas, 3, 4); // 获取五日线条canvas
		KlineDataSpliceFunc(_results, type); // K线数据拼接
		if(KLineCanvas && results && results.length > 0) { // 计算今日K线数据
			var point = common.typePoint(stock.stockType); // 根据股票类型判断价格位数
			var currentHigh = results[0].high; // 将第一个点最高价初始为当前最高价
			var currentLow = results[0].low; // 将第一个点最低价初始为当前最低价
			for (var i = 0; i < results.length; i++) { // 获取最值
				currentHigh = Math.max(currentHigh, results[i].high);
				currentLow = Math.min(currentLow, results[i].low); 
			}

			function coordCount(value) { // 坐标计算
				return minPaddingHeight + (minCanvasHeight - 2 * minPaddingHeight) * (currentHigh - value) / (currentHigh - currentLow);
			}

			var ctx = KLineCanvas.getContext('2d'); // 获取画布
			ctx.save(); // 保存当前画布
			for (var i = 0; i < results.length; i++) { // 画蜡烛线
				var kLineColor = (results[i].close > results[i].open ? riseColor : (results[i].close < results[i].open ? fallColor : fontColor));
				ctx.beginPath();
				ctx.lineWidth = lineWidth; // 设置线宽
				ctx.strokeStyle = kLineColor;
				ctx.moveTo(isInteger(canvasWidth * (2 * i + 1) / (2 * count)), coordCount(results[i].high));
				ctx.lineTo(isInteger(canvasWidth * (2 * i + 1) / (2 * count)), coordCount(results[i].low));
				ctx.stroke();
				ctx.beginPath();
				ctx.fillStyle = kLineColor; 
				if(results[i].open == results[i].close) {
					ctx.fillRect(global.hqKLineSpace + canvasWidth * i / count, isInteger(coordCount(results[i].open)) - 1, global.hqKLineSpace * 3 * 2, 2);
				} else {
					ctx.fillRect(global.hqKLineSpace + canvasWidth * i / count, isInteger(coordCount(results[i].open)), global.hqKLineSpace * 3 * 2, (minCanvasHeight - 2 * minPaddingHeight) * (results[i].open - results[i].close) / (currentHigh - currentLow));
				}
				ctx.stroke();
			}
			ctx.beginPath();
			ctx.strokeStyle = ma5Color; 
			for (var i = 0; i < results.length; i++) { // ma5指标线绘制
				if(results[i].ma5 > currentHigh || results[i].ma5 < currentLow) continue;
				var x = canvasWidth * (2 * i + 1) / (2 * count);
				var y = coordCount(results[i].ma5);
				i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = ma10Color; 
			for (var i = 0; i < results.length; i++) { // ma10指标线绘制
				if(results[i].ma10 > currentHigh || results[i].ma10 < currentLow) continue;
				var x = canvasWidth * (2 * i + 1) / (2 * count);
				var y = coordCount(results[i].ma10);
				i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = ma20Color; 
			for (var i = 0; i < results.length; i++) { // ma20指标线绘制
				if(results[i].ma20 > currentHigh || results[i].ma20 < currentLow) continue;
				var x = canvasWidth * (2 * i + 1) / (2 * count);
				var y = coordCount(results[i].ma20);
				i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = ma60Color; 
			for (var i = 0; i < results.length; i++) { // ma60指标线绘制
				if(results[i].ma60 > currentHigh || results[i].ma60 < currentLow) continue;
				var x = canvasWidth * (2 * i + 1) / (2 * count);
				var y = coordCount(results[i].ma60);
				i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
			}
			ctx.stroke();
			ctx.beginPath();
			ctx.textAlign = "left";
			ctx.font = fontStyle;
			ctx.fillStyle = fontColor;
			ctx.fillText(currentHigh.toFixed(point), 0, minPaddingHeight + 16);
			ctx.fillText(currentLow.toFixed(point), 0, minCanvasHeight - minPaddingHeight - 3);
			ctx.restore();
			drawTargetKLineFunc(type, targetType); // 下半部分成交量等指标绘制
		}
	}

	/**
	 * K线指标切换画图
	 * @param type K线类型 日K、周K、月K
	 * @param targetType 指标类型 0-成交量 1-MACD 2-BOLL 3-KDJ
	 * */
	function drawTargetKLineFunc(type, targetType) {
		var KLineCanvas = $(_pageId + "#" + type + " canvas")[0];
		if(KLineCanvas && results && results.length > 0) {
			var maxVol = results[0].volume; // 初始化第一个点的成交量为最大成交量
			var closeArray = []; // 收盘价集合
			for (var i = 1; i < results.length; i++) { // 获取最值
				maxVol = Math.max(maxVol, results[i].volume);
				closeArray.push(results[i].close);
			}
			var ctx = KLineCanvas.getContext('2d'); // 获取画布
			ctx.save(); // 保存当前画布
			ctx.clearRect(0, minCanvasHeight, canvasWidth, canvasHeight - minCanvasHeight); // 指标切换时清理canvas指标区域
			ctx.beginPath(); // 指标提示说明文字
			ctx.textAlign = "left";
			ctx.font = fontStyle;
			ctx.fillStyle = fontColor;
			if(targetType == 0) {
				ctx.fillText("VOL", 0, minHeight);
			} else if(targetType == 1) {
				ctx.fillText("MACD(12, 26, 9)", 0, minHeight);
			} else if(targetType == 2) {
				ctx.fillText("BOLL(20)", 0, minHeight);
			} else if(targetType == 3) {
				ctx.fillText("KDJ(9, 3, 3)", 0, minHeight);
			}
			ctx.textAlign = "center";
			if(results.length > Math.floor(count / 3 - 1 / 2)) { // 第一根竖线的日期
				ctx.fillText(results[Math.floor(count / 3 - 1 / 2)].date, canvasWidth / 3, minHeight);
			}
			if(results.length > Math.floor(count * 2 / 3 - 1 / 2)) { // 第二根竖线的日期
				ctx.fillText(results[Math.floor(count * 2 / 3 - 1 / 2)].date, canvasWidth * 2 / 3, minHeight);
			}
			ctx.textAlign = "right";
			if(stock && ":7:15:".indexOf(":" + stock.stockType + ":") < 0) { // 指数不显示复权
				ctx.fillText(global.rehabilitationName, canvasWidth, minHeight);
			}

			ctx.beginPath(); // clear之后重新画分隔线
			ctx.strokeStyle = strokeColor; // 定义框架线颜色样式
			ctx.moveTo(isInteger(canvasWidth / 3), minHeight);
			ctx.lineTo(isInteger(canvasWidth / 3), canvasHeight);
			ctx.moveTo(isInteger(canvasWidth * 2 / 3), minHeight);
			ctx.lineTo(isInteger(canvasWidth * 2 / 3), canvasHeight);
			ctx.stroke();

			if(targetType == 0) { // 成交量绘制
				for (var i = 0; i < results.length; i++) {
					var kLineColor = (results[i].close >= results[i].open ? riseColor : fallColor);
					ctx.beginPath();
					ctx.fillStyle = kLineColor; 
					ctx.fillRect(global.hqKLineSpace + canvasWidth * i / count, canvasHeight, global.hqKLineSpace * 3 * 2, -(results[i].volume * volHeight / maxVol));
					ctx.stroke();
				}
			} else if(targetType == 1) { // MACD绘制
				if(results.length <= 1) return;
				function ema(value, day, preEma) { // day日指数平均值，preEma为(day-1)日指数平均值
					return value * 2 / (day + 1) + preEma * (day - 1) / (day + 1);
				}
				diff = [], dea = [], macd = []; // DIFF、DEA、MACD指标集合
				var ema12 = []; //  十二日指数平均值
				var ema26 = []; //  二十六日指数平均值
				var maxDiff = 0; // 确定MACD曲线最值
				for (var i = 0; i < results.length; i++) { // DIFF、DEA、MACD指标计算
					if(i == 0) {
						ema12.push(results[i].close);
						ema26.push(results[i].close);
						diff.push(ema12[i] - ema26[i]);
						dea.push(0);
					} else {
						ema12.push(ema(results[i].close, 12, ema12[i - 1]));
						ema26.push(ema(results[i].close, 26, ema26[i - 1]));
						diff.push(ema12[i] - ema26[i]);
						dea.push(ema(diff[i], 9, dea[i - 1]));
					}
					macd.push(2 * (diff[i] - dea[i]));
					maxDiff = Math.max(maxDiff, Math.abs(diff[i]), Math.abs(macd[i]));
				}
				for (var i = 0; i < macd.length; i++) { // MACD柱状图macd指标绘制
					var kLineColor = macd[i] >= 0 ? riseColor : fallColor;
					ctx.beginPath();
					ctx.fillStyle = kLineColor; 
					ctx.fillRect(global.hqKLineSpace + canvasWidth * i / count, canvasHeight - volHeight / 2, global.hqKLineSpace * 3 * 2, -macd[i] * volHeight / (2 * maxDiff));
					ctx.stroke();
				}
				ctx.beginPath();
				ctx.strokeStyle = ma10Color; 
				ctx.lineWidth = lineWidth; // 设置线宽
				for (var i = 0; i < diff.length; i++) { // DIFF指标线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = -diff[i] * volHeight / (2 * maxDiff) + canvasHeight - volHeight / 2;
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma20Color; 
				for (var i = 0; i < dea.length; i++) { // DEA指标线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y =canvasHeight - volHeight / 2 - dea[i] * volHeight / (2 * maxDiff);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
			} else if(targetType == 2) { // BOLL绘制
				if(results.length < 20) return;
				up = [], mb = [], dn = [];
				var maN = []; // N日内的收盘价之和÷N
				var mdN = []; // 标准差 平方根N日的（close－ma）的两次方之和除以N
				var maxBoll = results[0].high; // boll指标最大值
				var minBoll = results[0].low; // boll指标最小值
				for (var i = 0; i < results.length; i++) { // 指标值计算、最值计算
					if(i == 0) {
						maN.push(results[i].close / (i + 1));
						mdN.push((results[i].close - maN[i]) / (i + 1));
						mb.push(results[i].close);
						up.push(results[i].close);
						dn.push(results[i].close);
					} else {
						if(i < 20) {
							maN.push((maN[i - 1] * i + results[i].close) / (i + 1));
							mdN.push((mdN[i - 1] * i + Math.abs(results[i].close - maN[i])) / (i + 1));
						} else {
							maN.push((maN[i - 1] * 20 + results[i].close - results[i - 20].close) / 20);
							mdN.push((mdN[i - 1] * 20 + Math.abs(results[i].close - maN[i])) / 20);
						}
						mb.push(maN[i - 1]);
						up.push(mb[i] + 2 * mdN[i]);
						dn.push(mb[i] - 2 * mdN[i]);
						maxBoll = Math.max(maxBoll, up[i], results[i].high);
						minBoll = Math.min(minBoll, dn[i], results[i].low);
					}
				}
				ctx.beginPath();
				ctx.strokeStyle = ma20Color;
				ctx.lineWidth = lineWidth;
				for (var i = 0; i < results.length; i++) { // 价格线绘制
					ctx.moveTo(global.hqKLineSpace + canvasWidth * i / count, isInteger(minHeight + (maxBoll - results[i].open) * volHeight / (maxBoll - minBoll))); // 左横线
					ctx.lineTo(4 * global.hqKLineSpace + canvasWidth * i / count, isInteger(minHeight + (maxBoll - results[i].open) * volHeight / (maxBoll - minBoll)));
					ctx.moveTo(4 * global.hqKLineSpace + canvasWidth * i / count, isInteger(minHeight + (maxBoll - results[i].close) * volHeight / (maxBoll - minBoll))); // 右横线
					ctx.lineTo(7 * global.hqKLineSpace + canvasWidth * i / count, isInteger(minHeight + (maxBoll - results[i].close) * volHeight / (maxBoll - minBoll)));
					ctx.moveTo(isInteger(4 * global.hqKLineSpace + canvasWidth * i / count), minHeight + (maxBoll - results[i].high) * volHeight / (maxBoll - minBoll)); // 中竖线
					ctx.lineTo(isInteger(4 * global.hqKLineSpace + canvasWidth * i / count), minHeight + (maxBoll - results[i].low) * volHeight / (maxBoll - minBoll));
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma60Color; 
				for (var i = 0; i < up.length; i++) { // 上轨线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxBoll - up[i]) * volHeight / (maxBoll - minBoll);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma10Color; 
				for (var i = 0; i < mb.length; i++) { // 中轨线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxBoll - mb[i]) * volHeight / (maxBoll - minBoll);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma5Color; 
				for (var i = 0; i < dn.length; i++) { // 下轨线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxBoll - dn[i]) * volHeight / (maxBoll - minBoll);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
			} else if(targetType == 3) { // KDJ绘制
				if(results.length <= 9) return;
				function mostValue(index, type) { // 最值计算
					var i = index - 9 + 1;
					if (i < 0) i = 0;
					var min = results[index].low;
					var max = results[index].high;
					for (; i <= index; i++) {
						if (results[i].low < min) min = results[i].low;
						if (results[i].high > max) max = results[i].high;
					}
					if(type == 1) { // 最小值
						return min;
					} else if(type == 2) { // 最大值
						return max;
					} else {
						return 0;
					}
				}
				kdj_k = [], kdj_d = [], kdj_j = [];
				var maxKdj = 100; // kdj指标最大值 默认100
				var minKdj = 0; // kdj指标最小值 默认0
				for (var i = 0; i < results.length; i++) { // 计算k、d、j指标值 
					if(mostValue(i, 2) - mostValue(i, 1) == 0) {
						var rsv = 0;
					} else {
						var rsv = (results[i].close - mostValue(i, 1)) / (mostValue(i, 2) - mostValue(i, 1)) * 100;
					}
					var currK = i > 0 ? kdj_k[i - 1] : rsv;
					var currD = i > 0 ? kdj_d[i - 1] : rsv;
					kdj_k.push(currK * 2 / 3 + rsv / 3);
					kdj_d.push(currD * 2 / 3 + kdj_k[i] / 3);
					kdj_j.push(kdj_k[i] * 3 - kdj_d[i] * 2);
					maxKdj = Math.max(maxKdj, kdj_j[i]);
					minKdj = Math.min(minKdj, kdj_j[i]);
				}
				ctx.beginPath();
				ctx.strokeStyle = ma10Color;
				ctx.lineWidth = lineWidth;
				for (var i = 0; i < kdj_k.length; i++) { // K线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxKdj - kdj_k[i]) * volHeight / (maxKdj - minKdj);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma20Color;
				ctx.lineWidth = lineWidth;
				for (var i = 0; i < kdj_d.length; i++) { // D线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxKdj - kdj_d[i]) * volHeight / (maxKdj - minKdj);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
				ctx.beginPath();
				ctx.strokeStyle = ma5Color;
				ctx.lineWidth = lineWidth;
				for (var i = 0; i < kdj_j.length; i++) { // J线绘制
					var x = canvasWidth * (2 * i + 1) / (2 * count);
					var y = minHeight + (maxKdj - kdj_j[i]) * volHeight / (maxKdj - minKdj);
					i == 0 ? ctx.moveTo(isInteger(x), y) : ctx.lineTo(isInteger(x), y);
				}
				ctx.stroke();
			}
			ctx.restore();
		}
	}

	/**
	 * K线数据拼接
	 * 复制历史数据
	 * 拼接实时数据
	 * @param _results 历史K线数据
	 * @param type K线类型
	 * 注：合约的K线有点问题，1.判断是否在同周、同月都是false 2.没有假数据
	 * */ 
	function KlineDataSpliceFunc(_results, type) {
		results = []; // 先清空，避免_results执行return后results的数据还在
		if(!_results || _results.length < 1) return;
		results = common.clone(_results); // 克隆对象，避免下面代码改变原始对象
		if(stock[type]) { // 表示今日同最近的上一个交易日K线数据是在同周、同月
			var penultArr = results[results.length - 2]; // 获取K线倒数第二条数据
			var kLineJson = {
					"date" : window.hvDate, // 日期
					"open" : penultArr.open, // 开盘价
					"high" : stock.high > penultArr.high ? stock.high : penultArr.high, // 最高价
							"close" : stock.now || 0, // 收盘价
							"low" : stock.low < penultArr.low ? stock.low : penultArr.low, // 最低价
									"volume" : stock.volume + penultArr.volume, // 成交量
									"amount" : stock.amount + penultArr.amount, // 成交额
									"ma5" : penultArr.ma5 + (stock.now - penultArr.close) * 0.2, // ma5
									"ma10" : penultArr.ma10 + (stock.now - penultArr.close) * 0.1, // ma10
									"ma20" : penultArr.ma20 + (stock.now - penultArr.close) * 0.05, // ma20
									"ma60" : penultArr.ma60 + (stock.now - penultArr.close) / 60 // ma60
			};
			if(stock && stock.open != 0) { // 9:30之前只有昨收价，其它价格为假价格 0
				results.length -= 2; // 删除最后的假数据和倒数第二条的真实数据
			} else {
				results.length -= 1; // 并且9:30之前不要删除两条，因为不会填充今天的数据
			}
		} else { // 表示不再同日、同周、同月 需与最后的假数据结合构成今天的实时K线数据
			var lastArr = results[results.length - 1]; // 获取K线最后一条假数据
			var kLineJson = {
					"date" : window.hvDate, // 日期
					"open" : stock.open || 0, // 开盘价
					"high" : stock.high || 0, // 最高价
					"close" : stock.now || 0, // 收盘价
					"low" : stock.low || 0, // 最低价
					"volume" : stock.volume || 0, // 成交量
					"amount" : stock.amount || 0, // 成交额
					"ma5" : lastArr.ma5 + stock.now * 0.2, // ma5
					"ma10" : lastArr.ma10 + stock.now * 0.1, // ma10
					"ma20" : lastArr.ma20 + stock.now * 0.05, // ma20
					"ma60" : lastArr.ma60 + stock.now / 60 // ma60
			};
			results.length -= 1; // 删除最后的假数据
		}
		if(stock && stock.open && stock.open != 0) { // 9:30之前只有昨收价，其它价格为假价格 0，所以避免错误价格使K线图画错
			results.push(kLineJson); // 将今天的实时K线数据添加到结果集中
		}
		if(results.length > count) { // 加载更多历史K线数据时需截取需要展示的数据
			results = historyLoadCount > 0 ? results.slice(-(count + historyLoadCount), -historyLoadCount) : results.slice(-count);
		}
	}

	/**
	 * 移动的十字架
	 * @param moveX 移动的x值
	 * @param moveY 移动的y值
	 * @param _results 移动所需的行情数据
	 * @param _stock 实时数据
	 * @param type 行情图类型 分时、五日、K线等
	 * @param targetType K线指标类型 0-成交量 1-MACD 2-BOLL 3-KDJ
	 * */
	function moveCruxFunc(moveX, moveY, _results, _stock, type, targetType) {
		stock = _stock;
		var cruxCanvas = $(_pageId + "#crux canvas")[0];
		if(cruxCanvas && _results.length > 0) {
			var point = common.typePoint(stock.stockType); // 股票类型判断位数
			if(type == "min") { // 分时
				results = _results;
				var prec = stock.prec; // 昨收
				if(stock.market == "HK" || stock.stockType == 99) { // 判断是否为港股通
					var space = (canvasWidth - 2) / (332 - 1); // 港股通分时有332个点
				} else {
					var space = (canvasWidth - 2) / (242 - 1); // 计算分时点间距 减去边框线的宽度，在可视区域绘制对应点数
				}
			} else if(type == "five") { // 五日
				results = _results;
				var prec = results[0].prec; // 昨收
				if(stock.market == "HK" || stock.stockType == 99) { // 判断是否为港股通
					var space = (canvasWidth - 2) / (335 - 1); // 港股通分时有330个点 五日分时一日点每4个一点
				} else {
					var space = (canvasWidth - 2) / (305 - 1);
				}
			} else if("day,week,month".indexOf(type) > -1) { // K线
				KlineDataSpliceFunc(_results, type); // K线数据拼接
				if(!results || results.length < 1) return;
			}
			var ctx = cruxCanvas.getContext('2d'); // 获取十字架画布
			ctx.save(); // 保存当前画布 避免下次绘制时本次给canvas标签增加的样式影响其效果
			ctx.clearRect(0, 0, canvasWidth, canvasHeight); // 清理画布上的内容
			if("day,week,month".indexOf(type) > -1) {
				var currentHigh = results[0].high; // 将第一个点最高价初始为当前最高价
				var currentLow = results[0].low; // 将第一个点最低价初始为当前最低价
				var maxVol = results[0].volume; // 初始化最大成交量
				for (var i = 0; i < results.length; i++) { // 获取最值
					currentHigh = Math.max(currentHigh, results[i].high);
					currentLow = Math.min(currentLow, results[i].low); 
					maxVol = Math.max(maxVol, results[i].volume);
				}
				var i = Math.round((moveX / cruxCanvas.clientWidth * canvasWidth - 1) / (global.hqKLineSpace * 8));
				i = i < 0 ? 0 : (results.length - 1 > i ? i : results.length - 1); // 处理移出左边canvas时通过i去获取结果集报错
				var stockInfo = results[i];
				if(results.length - 1 > i) { // 当前坐标在结果集产生的坐标集当中
					moveX = canvasWidth * (2 * i + 1) / (2 * count);
				} else { // 最右边限定移动的横坐标
					moveX = canvasWidth * (2 * (results.length - 1) + 1) / (2 * count);
				}
				moveX = moveX < 0 ? 0 : moveX; // 最左边限定移动的横坐标
				moveY = moveY / cruxCanvas.clientHeight * canvasHeight;
				ctx.beginPath(); // 开始一条路径
				ctx.strokeStyle = fontColor; // 定义十字架线颜色样式
				ctx.lineWidth = lineWidth; // 定义十字架线线宽样式
				ctx.moveTo(isInteger(moveX), 0);
				ctx.lineTo(isInteger(moveX), canvasHeight);
				ctx.moveTo(0, isInteger(moveY));
				ctx.lineTo(canvasWidth, isInteger(moveY));
				ctx.stroke();	

				ctx.beginPath(); // 绘制移动的框
				ctx.fillStyle = backgroundFillColor; // 价格线封闭的框色值
				ctx.globalAlpha = 0.8; // 价格线封闭的透明度
				if(moveX < canvasWidth * 0.5) { // 移动框、实时数据 当在左边时
					ctx.fillRect(moveX + 10, minPaddingHeight + 30, 190, 210); // 绘制价格封闭框
					var formX = moveX + 15;
				} else { // 移动框、实时数据 当在右边时
					ctx.fillRect(moveX - 10, minPaddingHeight + 30, -190, 210); // 绘制价格封闭框
					var formX = moveX - 195;
				}
				ctx.restore(); // 取出之前保存的画布 与save对应
				ctx.beginPath(); // 水平线左右边的框
				ctx.font = fontStyle; // 定义字体样式
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("日期：" + stockInfo.date, formX, minPaddingHeight + 50);
				ctx.fillText("开盘价：" + stockInfo.open.toFixed(point), formX, minPaddingHeight + 80);
				ctx.fillText("最高价：" + stockInfo.high.toFixed(point), formX, minPaddingHeight + 110);
				ctx.fillText("收盘价：" + stockInfo.close.toFixed(point), formX, minPaddingHeight + 140);
				ctx.fillText("最低价：" + stockInfo.low.toFixed(point), formX, minPaddingHeight + 170);
				ctx.fillText("成交量：" + (stockInfo.volume > 10000 ? common.judgeColorValue(3, stockInfo.volume) + ((stock.market == "HK" || stock.stockType == 99) ? "股" : "手") : stockInfo.volume), formX, minPaddingHeight + 200);
				ctx.fillText("成交额：" + common.judgeColorValue(3, stockInfo.amount), formX, minPaddingHeight + 230);

				var startX = ctx.measureText(currentHigh.toFixed(point)).width + 10; // 文本距离左右边的宽度值
				ctx.beginPath(); // ma5的原点
				ctx.fillStyle = ma5Color; 
				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma5颜色值的圆
				ctx.fill();
				ctx.beginPath(); // ma5的值
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("MA5 " + stockInfo.ma5.toFixed(point), startX + 10, minPaddingHeight + 18);
				startX = ctx.measureText(currentHigh.toFixed(point) + "MA5 " + stockInfo.ma5.toFixed(point)).width + 30;
				ctx.beginPath(); // ma10的原点
				ctx.fillStyle = ma10Color; 
				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma10颜色值的圆
				ctx.fill();
				ctx.beginPath(); // ma10的值
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("MA10 " + stockInfo.ma10.toFixed(point), startX + 10, minPaddingHeight + 18);
				startX = ctx.measureText(currentHigh.toFixed(point) + "MA5 " + stockInfo.ma5.toFixed(point) + "MA10 " + stockInfo.ma10.toFixed(point)).width + 50;
				ctx.beginPath(); // ma20的原点
				ctx.fillStyle = ma20Color; 
				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma20颜色值的圆
				ctx.fill();
				ctx.beginPath(); // ma20的值
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("MA20 " + stockInfo.ma20.toFixed(point), startX + 10, minPaddingHeight + 18);
				startX = ctx.measureText(currentHigh.toFixed(point) + "MA5 " + stockInfo.ma5.toFixed(point) + "MA10 " + stockInfo.ma10.toFixed(point) + "MA20 " + stockInfo.ma20.toFixed(point)).width + 70;
				ctx.beginPath(); // ma60的原点
				ctx.fillStyle = ma60Color; 
				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma20颜色值的圆
				ctx.fill();
				ctx.beginPath(); // ma60的值
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("MA60 " + stockInfo.ma60.toFixed(point), startX + 10, minPaddingHeight + 18);

				var moveCurrPrice = currentHigh - (moveY - minPaddingHeight) * (currentHigh - currentLow) / (minCanvasHeight - 2 * minPaddingHeight); // 移动的价格
				if(Math.round(moveY) < minCanvasHeight) { // 处于价图中
					ctx.beginPath(); // 水平线左右边的框
					ctx.font = fontStyle; // 定义字体样式
					ctx.fillStyle = backgroundFillColor; // 价格背景框色值
					if(moveX < canvasWidth * 0.5) {
						ctx.fillRect(canvasWidth - ctx.measureText(moveCurrPrice.toFixed(point)).width - 5, isInteger(moveY) - 10, ctx.measureText(moveUppercent).width + 5, 20);
						ctx.fillStyle = fontColor; // 定义字体颜色样式
						ctx.textAlign = "right";
						ctx.fillText(moveCurrPrice.toFixed(point), canvasWidth, isInteger(moveY) + 6);
					} else {
						ctx.fillRect(0, isInteger(moveY) - 10, ctx.measureText(moveCurrPrice.toFixed(point)).width + 5, 20);
						ctx.fillStyle = fontColor; // 定义字体颜色样式
						ctx.textAlign = "left";
						ctx.fillText(moveCurrPrice.toFixed(point), 0, isInteger(moveY) + 6);
					}
				} else if(Math.round(moveY) < minHeight) { // 处于日期时间区域中
				} else { // 处于量图中
					var targetText = "";
					if(targetType == 0) { // 成交量
						targetText = (canvasHeight - moveY) * maxVol / volHeight; // 移动的成交量
						targetText = common.judgeColorValue(3, targetText); // 格式化数据
					} else if(targetType == 1) { // MACD
						if(results.length <= 1) return;
						var maxMacd = diff[0]; // 将macd指标里面的diff指标的第一个值作为初始值
						for (var j = 0; j < diff.length; j++) {
							maxMacd = Math.max(maxMacd, Math.abs(diff[j]), Math.abs(macd[j]));
						}
						targetText = (canvasHeight - volHeight / 2 - moveY) * 2 * maxMacd / volHeight;
						targetText = targetText.toFixed(2);
					} else if(targetType == 2) { // BOLL
						if(results.length < 20) return;
						var maxBoll = results[0].high; // boll指标最大值
						var minBoll = results[0].low; // boll指标最小值
						for (var j = 0; j < results.length; j++) { // 指标值计算、最值计算
							maxBoll = Math.max(maxBoll, up[j], results[j].high);
							minBoll = Math.min(minBoll, dn[j], results[j].low);
						}
						targetText = maxBoll - (moveY - minHeight) * (maxBoll - minBoll) / volHeight;
						targetText = targetText.toFixed(2);
					} else if(targetType == 3) { // KDJ
						if(results.length <= 9) return;
						var maxKdj = 100; // kdj指标最大值 默认100
						var minKdj = 0; // kdj指标最小值 默认0
						for (var j = 0; j < kdj_j.length; j++) { // 计算k、d、j指标值 
							maxKdj = Math.max(maxKdj, kdj_j[j]);
							minKdj = Math.min(minKdj, kdj_j[j]);
						}
						targetText = maxKdj - (moveY - minHeight) * (maxKdj - minKdj) / volHeight;
						targetText = targetText.toFixed(2);
					}
					ctx.beginPath(); // 水平线左右边的框
					ctx.font = fontStyle; // 定义字体样式
					ctx.fillStyle = backgroundFillColor; // 价格背景框色值
					if(moveX < canvasWidth * 0.5) {
						ctx.fillRect(canvasWidth - ctx.measureText(targetText).width - 5, isInteger(moveY) - 10, ctx.measureText(targetText).width + 5, 20);
						ctx.fillStyle = fontColor; // 定义字体颜色样式
						ctx.textAlign = "right";
						ctx.fillText(targetText, canvasWidth, isInteger(moveY) + 6);
					} else {
						ctx.fillRect(0, isInteger(moveY) - 10, ctx.measureText(targetText).width + 5, 20);
						ctx.fillStyle = fontColor; // 定义字体颜色样式
						ctx.textAlign = "left";
						ctx.fillText(targetText, 0, isInteger(moveY) + 6);
					}
				}
//				if(moveX < canvasWidth * 0.5) { // 填写有颜色的指标值
//				var startX = ctx.measureText(currentHigh).width + 10; // 文本距离左右边的宽度值
//				ctx.beginPath(); // ma5的原点
//				ctx.fillStyle = ma5Color; 
//				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma5颜色值的圆
//				ctx.fill();
//				ctx.beginPath(); // ma5的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "left";
//				ctx.fillText("MA5 " + stockInfo.ma5.toFixed(point), startX + 10, minPaddingHeight + 18);
//				startX = ctx.measureText(currentHigh + "MA5 " + stockInfo.ma5.toFixed(point)).width + 30;
//				ctx.beginPath(); // ma10的原点
//				ctx.fillStyle = ma10Color; 
//				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma10颜色值的圆
//				ctx.fill();
//				ctx.beginPath(); // ma10的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "left";
//				ctx.fillText("MA10 " + stockInfo.ma10.toFixed(point), startX + 10, minPaddingHeight + 18);
//				startX = ctx.measureText(currentHigh + "MA5 " + stockInfo.ma5.toFixed(point) + "MA10 " + stockInfo.ma10.toFixed(point)).width + 50;
//				ctx.beginPath(); // ma20的原点
//				ctx.fillStyle = ma20Color; 
//				ctx.arc(startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma20颜色值的圆
//				ctx.fill();
//				ctx.beginPath(); // ma20的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "left";
//				ctx.fillText("MA20 " + stockInfo.ma20.toFixed(point), startX + 10, minPaddingHeight + 18);
//				} else {
//				var startX = 0; // 文本距离左右边的宽度值
//				ctx.beginPath(); // ma20的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "right";
//				ctx.fillText("MA20 " + stockInfo.ma20.toFixed(point), canvasWidth, minPaddingHeight + 18);
//				startX = ctx.measureText("MA20 " + stockInfo.ma20.toFixed(point)).width + 10;
//				ctx.beginPath(); // ma20的原点
//				ctx.fillStyle = ma20Color; 
//				ctx.arc(canvasWidth - startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma20颜色值的圆
//				ctx.fill();
//				ctx.beginPath(); // ma10的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "right";
//				ctx.fillText("MA10 " + stockInfo.ma10.toFixed(point), canvasWidth - startX - 10, minPaddingHeight + 18);
//				startX = ctx.measureText("MA10 " + stockInfo.ma10.toFixed(point) + "MA20 " + stockInfo.ma20.toFixed(point)).width + 30;
//				ctx.beginPath(); // ma10的原点
//				ctx.fillStyle = ma10Color; 
//				ctx.arc(canvasWidth - startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma10颜色值的圆
//				ctx.fill();
//				ctx.beginPath(); // ma5的值
//				ctx.fillStyle = fontColor; // 定义字体颜色样式
//				ctx.textAlign = "right";
//				ctx.fillText("MA5 " + stockInfo.ma5.toFixed(point), canvasWidth - startX - 10, minPaddingHeight + 18);
//				startX = ctx.measureText("MA5 " + stockInfo.ma5.toFixed(point) + "MA10 " + stockInfo.ma10.toFixed(point) + "MA20 " + stockInfo.ma20.toFixed(point)).width + 50;
//				ctx.beginPath(); // ma5的原点
//				ctx.fillStyle = ma5Color; 
//				ctx.arc(canvasWidth - startX, minPaddingHeight + 10, 5, 0, 2 * Math.PI); // 绘制ma5颜色值的圆
//				ctx.fill();
//				}
				if(targetType == 1) { // MACD指标点
					if(results.length <= 1) return;
					var startX = 0;
					ctx.beginPath();
					ctx.fillStyle = ma10Color; // DIFF指标线用ma10的颜色值
					ctx.textAlign = "left";
					ctx.fillText("DIFF: " + diff[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("DIFF: " + diff[i].toFixed(3)).width + 10;
					ctx.fillStyle = ma20Color; // DEA指标线用ma20的颜色值
					ctx.fillText("DEA: " + dea[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("DEA: " + dea[i].toFixed(3) + "DIFF: " + diff[i].toFixed(3)).width + 20;
					ctx.fillStyle = ma5Color; // MACD指标线用ma5的颜色值
					ctx.fillText("MACD: " + macd[i].toFixed(3), startX, minHeight + 18);
				} else if(targetType == 2) { // BOLL指标点
					if(results.length < 20) return;
					var startX = 0;
					ctx.beginPath();
					ctx.fillStyle = ma60Color; // UPPER指标线用ma60的颜色值
					ctx.textAlign = "left";
					ctx.fillText("UPPER: " + up[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("UPPER: " + up[i].toFixed(3)).width + 10;
					ctx.fillStyle = ma10Color; // MID指标线用ma10的颜色值
					ctx.fillText("MID: " + mb[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("UPPER: " + up[i].toFixed(3) + "MID: " + mb[i].toFixed(3)).width + 20;
					ctx.fillStyle = ma5Color; // LOWER指标线用ma5的颜色值
					ctx.fillText("LOWER: " + dn[i].toFixed(3), startX, minHeight + 18);
				} else if(targetType == 3) { // KDJ指标点
					if(results.length <= 9) return;
					var startX = 0;
					ctx.beginPath();
					ctx.fillStyle = ma10Color; // K指标线用ma10的颜色值
					ctx.textAlign = "left";
					ctx.fillText("K: " + kdj_k[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("K: " + kdj_k[i].toFixed(3)).width + 10;
					ctx.fillStyle = ma20Color; // D指标线用ma20的颜色值
					ctx.fillText("D: " + kdj_d[i].toFixed(3), startX, minHeight + 18);
					startX = ctx.measureText("D: " + kdj_d[i].toFixed(3) + "K: " + kdj_d[i].toFixed(3)).width + 20;
					ctx.fillStyle = ma5Color; // J指标线用ma5的颜色值
					ctx.fillText("J: " + kdj_j[i].toFixed(3), startX, minHeight + 18);
				}
			} else {
				var maxMinDiff = 0; // 差值 确定上下限值
				var maxVol = 0; // 确定成交量最大值
				for (var i = 0; i < results.length; i++) { // 获取最大成交量值和最大价格与昨收的差值
					var volue = Math.abs(results[i].currPrice - prec); // 获取每分钟价格与昨收的差值
					maxMinDiff = (maxMinDiff < volue) ? volue : maxMinDiff; // 确定最大差值
					maxVol = (maxVol < results[i].volume) ? results[i].volume : maxVol;
				}
				var i = Math.round((moveX / cruxCanvas.clientWidth * canvasWidth - 1) / space); // 获取results结果集坐标对应的下标
				i = i < 0 ? 0 : i; // 处理移出左边canvas时通过i去获取结果集报错
				var stockInfo = results[results.length - 1 > i ? i : results.length - 1];
				if(results.length - 1 > i) { // 当前坐标在结果集产生的坐标集当中
					moveX = moveX / cruxCanvas.clientWidth * canvasWidth;
				} else { // 最右边限定移动的横坐标
					moveX = (results.length - 1) * space + 1;
				}
				moveX = moveX < 0 ? 0 : moveX; // 最左边限定移动的横坐标
				var moveY = moveY / cruxCanvas.clientHeight * canvasHeight;
				ctx.beginPath(); // 开始一条路径
				ctx.strokeStyle = fontColor; // 定义十字架线颜色样式
				ctx.lineWidth = lineWidth; // 定义十字架线线宽样式
				ctx.moveTo(isInteger(moveX), 0);
				ctx.lineTo(isInteger(moveX), canvasHeight);
				ctx.moveTo(0, isInteger(moveY));
				ctx.lineTo(canvasWidth, isInteger(moveY));
				ctx.stroke();
				ctx.beginPath(); // 十字架原点的圆 空心圆
				ctx.strokeStyle = fontColor; 
				ctx.arc(isInteger(moveX), isInteger(moveY), 6, 0, 2 * Math.PI); // 绘制最后一个价格点的圆
				ctx.stroke();
				ctx.beginPath(); // 十字架原点的圆 实心圆
				ctx.fillStyle = "#FFFFFF"; 
				ctx.arc(isInteger(moveX), isInteger(moveY), 4, 0, 2 * Math.PI); // 绘制最后一个价格点的圆
				ctx.fill();
				var startY = (maxMinDiff + prec - stockInfo.currPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
				ctx.beginPath(); // 价格线上面的原点
				ctx.fillStyle = currColor; 
				ctx.arc(isInteger(moveX), minPaddingHeight + isInteger(startY), 5, 0, 2 * Math.PI); // 绘制当前坐标在价格线上的圆
				ctx.fill();
				startY = (maxMinDiff + prec - stockInfo.averPrice) / (2 * maxMinDiff) * (minCanvasHeight - minPaddingHeight * 2);
				ctx.beginPath(); // 均线上面的原点
				ctx.fillStyle = averColor; 
				ctx.arc(isInteger(moveX), minPaddingHeight + isInteger(startY), 5, 0, 2 * Math.PI); // 绘制当前坐标在均线上的圆
				ctx.fill();
				var moveCurrPrice = maxMinDiff + prec - ((moveY - minPaddingHeight) / (minCanvasHeight - 2 * minPaddingHeight) * 2 * maxMinDiff); // 移动的价格
				var moveUppercent = ((moveCurrPrice / prec - 1) * 100).toFixed(2) + "%"; // 移动的涨跌幅
				var moveVolume = (canvasHeight - moveY) * maxVol / volHeight; // 移动的成交量
				if(Math.round(moveY) < minCanvasHeight) { // 处于价图中
					ctx.beginPath(); // 水平线左右边的框
					ctx.font = fontStyle; // 定义字体样式
					ctx.fillStyle = backgroundFillColor; // 价格背景框色值
					ctx.fillRect(0, isInteger(moveY) - 10, ctx.measureText(moveCurrPrice.toFixed(point)).width + 5, 20);
					ctx.fillRect(canvasWidth - ctx.measureText(moveUppercent).width - 5, isInteger(moveY) - 10, ctx.measureText(moveUppercent).width + 5, 20);
					ctx.fillStyle = fontColor; // 定义字体颜色样式
					ctx.textAlign = "left";
					ctx.fillText(moveCurrPrice.toFixed(point), 0, isInteger(moveY) + 6);
					ctx.textAlign = "right";
					ctx.fillText(moveUppercent, canvasWidth, isInteger(moveY) + 6);
				} else if(Math.round(moveY) < minHeight) { // 处于日期时间区域中
				} else { // 处于量图中
					moveVolume = common.judgeColorValue(3, moveVolume); // 格式化数据
					ctx.beginPath(); // 水平线左右边的框
					ctx.font = fontStyle; // 定义字体样式
					ctx.fillStyle = backgroundFillColor; // 价格背景框色值
					ctx.fillRect(0, isInteger(moveY) - 10, ctx.measureText(moveVolume).width + 5, 20);
					ctx.fillStyle = fontColor; // 定义字体颜色样式
					ctx.textAlign = "left";
					ctx.fillText(moveVolume, 0, isInteger(moveY) + 6);
				}
				ctx.beginPath(); // 绘制移动的框
				ctx.fillStyle = backgroundFillColor; // 价格线封闭的框色值
				ctx.globalAlpha = 0.8; // 价格线封闭的透明度
				if(moveX < canvasWidth * 0.5) { // 移动框、实时数据 当在左边时
					ctx.fillRect(moveX + 10, minPaddingHeight, 180, 200); // 绘制价格封闭框
					var formX = moveX + 15;
				} else { // 移动框、实时数据 当在右边时
					ctx.fillRect(moveX - 10, minPaddingHeight, -180, 200); // 绘制价格封闭框
					var formX = moveX - 185;
				}
				ctx.restore(); // 取出之前保存的画布 与save对应
				ctx.beginPath(); // 水平线左右边的框
				ctx.font = fontStyle; // 定义字体样式
				ctx.fillStyle = fontColor; // 定义字体颜色样式
				ctx.textAlign = "left";
				ctx.fillText("时间：" + numberConvertDate(2, stockInfo.minutes), formX, minPaddingHeight + 20);
				ctx.fillText("现价：" + stockInfo.currPrice.toFixed(point), formX, minPaddingHeight + 50);
				ctx.fillText("均价：" + stockInfo.averPrice.toFixed(point), formX, minPaddingHeight + 80);
				ctx.fillText("涨幅：" + ((stockInfo.currPrice / prec - 1) * 100).toFixed(2) + "%", formX, minPaddingHeight + 110);
				ctx.fillText("涨额：" + (stockInfo.currPrice - prec).toFixed(point), formX, minPaddingHeight + 140);
				ctx.fillText("成交：" + (stockInfo.volume > 10000 ? common.judgeColorValue(3, stockInfo.volume) : stockInfo.volume) + ((stock.market == "HK" || stock.stockType == 99) ? "股" : "手"), formX, minPaddingHeight + 170);
			}
		}
	}

	function clearCanvasFunc() { // 清理分时、五日、K线上画布的内容
		//var _pageId = "#" + $.getCurrentPageObj().pageId + " ";
		if(_pageId == "")
		{
			return;
		}
		var jqCanvasNode = $(_pageId + ".line canvas");
		var flowCanvasNode = $(_pageId + "#fund canvas"); // 资金明细的canvas对象
		if(jqCanvasNode) {
			for (var i = 0; i < jqCanvasNode.length; i++) {
				var ctx = jqCanvasNode[i].getContext('2d'); // 获取画布
				ctx.clearRect(0, 0, canvasWidth, canvasHeight); // 清理画布上的内容
			}
		}
		if(flowCanvasNode && flowCanvasNode[0]) { // 清理资金明细画布
			var ctx = flowCanvasNode[0].getContext('2d'); // 获取画布
			ctx.clearRect(0, 0, flowCanvasNode[0].width, flowCanvasNode[0].height); // 清理画布上的内容
		}
	}

	/**
	 * 分时 五日 K线的线条
	 * @param canvas 画图对象
	 * @param verNumber 竖线条数
	 * @param tranNumber 横线条数
	 * */
	function lineFunc(canvas, verNumber, tranNumber) {
		if(canvas) { // 存在对象
			var ctx = canvas.getContext('2d'); // 获取画布
			ctx.clearRect(0, 0, canvasWidth, canvasHeight); // 清理画布上的内容
			ctx.beginPath(); // 开始一条路径
			ctx.strokeStyle = strokeColor; // 定义框架线颜色样式
			for (var i = 1; i < verNumber; i++) { // 画垂直竖线
				ctx.moveTo(isInteger(canvasWidth * i / verNumber), 0);
				ctx.lineTo(isInteger(canvasWidth * i / verNumber), minCanvasHeight);
				ctx.moveTo(isInteger(canvasWidth * i / verNumber), minHeight);
				ctx.lineTo(isInteger(canvasWidth * i / verNumber), canvasHeight);
			}
			for (var j = 1; j < tranNumber; j++) { // 画水平横线
				if(j / tranNumber == 0.5) { // 过滤掉正中间的横线
					continue;
				}
				ctx.stroke();
				ctx.beginPath(); // 开始另一条路径
				ctx.strokeStyle = dashedLineColor; // 定义虚线颜色样式
				var top = minPaddingHeight + isInteger((minCanvasHeight - minPaddingHeight * 2) * j / tranNumber);
				ctx.dashedLineTo(0, top, canvasWidth, top);
			}
			ctx.stroke();
			ctx.beginPath(); // 开始另一条路径
			ctx.strokeStyle = dashedLineColor; // 定义虚线颜色样式
			var top = minPaddingHeight + isInteger((minCanvasHeight - minPaddingHeight * 2) * 0.5); // 正中间距离顶部的距离
			ctx.dashedLineTo(0, top, canvasWidth, top); // 绘制水平居中曲线
			ctx.stroke();
		}
	}

	/**
	 * 数字整形判断
	 * 在canvas画图中整数的点画的线条会有毛边
	 * 处理方式为当为整数时加减0.5的大小
	 * */
	function isInteger(value) {
		var integetExp = /^[-]?\d+$/; // 整数
		return integetExp.test(value) ? value - .5 : value;
	}

	function numberConvertDate(type, value) { // 数字型转换成时间或日期格式
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

	/**
	 * 虚线绘制
	 * fromX,fromY起始原点横纵坐标值
	 * toX,toY横向纵向距离
	 * pattern 可不传 表示虚线粗细
	 * */
	CanvasRenderingContext2D.prototype.dashedLineTo = function (fromX, fromY, toX, toY, pattern) {
		// default interval distance -> 5px
		if (typeof pattern === "undefined") {pattern = 10;}
		// calculate the delta x and delta y
		var dx = (toX - fromX);
		var dy = (toY - fromY);
		var distance = Math.floor(Math.sqrt(dx * dx + dy * dy));
		var dashlineInteveral = (pattern <= 0) ? distance : (distance / pattern);
		var deltay = (dy / distance) * pattern;
		var deltax = (dx / distance) * pattern;
		// draw dash line
		this.beginPath();
		for(var dl = 0; dl < dashlineInteveral; dl++) {
			if(dl % 2) {
				this.lineTo(fromX + dl * deltax, fromY + dl * deltay);
			} else {    				
				this.moveTo(fromX + dl * deltax, fromY + dl * deltay);    				
			}    			
		}
		this.stroke();
	};

	function flowsDetailFunc(data) { // 资金明细方法
		var flowCanvasNode = $(_pageId + "#fund canvas"); // 资金明细的canvas对象
		if(flowCanvasNode && flowCanvasNode[0]) {
			function coorCount(type, slashLen, coreAngle, assAngle) { // type 表示是横坐标还是纵坐标 slashLen 表示斜长 coreAngle 表示核心角度 即占比角度 assAngle 表示之前占比角度(如散户流入时主力流入的角度)
				if(type == 1) { // 计算横坐标
					return slashLen * Math.cos(Math.PI * (coreAngle + 2 * assAngle) * 0.01);
				} else { // 计算纵坐标
					return slashLen * Math.sin(Math.PI * (coreAngle + 2 * assAngle) * 0.01);
				}
			}
			function xCoor(val) { // 判断横坐标的位置并确定偏移方向和偏移距离
				return (val > 25 && val < 75 ? -100 : 100);
			}
			var flowWidth = flowCanvasNode[0].width; // 画布的宽度
			var flowHeight = flowCanvasNode[0].height; // 画布的高度
			var R = flowHeight * 0.15; // 圆半径
			var cenX = flowHeight * 0.23; // 圆心横坐标值
			var lineR = R + 10; // 外圆的半径+10为占比线开始点到原点的距离
			var ctx = flowCanvasNode[0].getContext('2d'); // 获取画布
			ctx.clearRect(0, 0, flowWidth, flowHeight); // 画之前清空画布
			/**
			 * 今日资金流向明细圆图
			 * @param type 类型 1-主力流入 2-散户流入 3-主力流出 4-散户流出
			 * @param coreValue 当前对应类型占比
			 * @param assValue 之前已画类型占比
			 * */
			function toDayFlowLocus(type, coreValue, assValue) {
				if(coreValue <= 0) return; // 占比为0时不画实际占比
				var stateText = "";
				ctx.beginPath();
				switch(type) {
				case 1 : 
					ctx.strokeStyle = "red"; //主力流入圆线色值
					ctx.fillStyle = "red"; //主力流入占比线圆和点色值
					stateText = "主力流入";
					break;
				case 2 : 
					ctx.strokeStyle = riseColor; //散户流入圆线色值
					ctx.fillStyle = riseColor; //散户流入占比线圆和点色值
					stateText = "散户流入";
					break;
				case 3 : 
					ctx.strokeStyle = "green"; //主力流出圆线色值
					ctx.fillStyle = "green"; //主力流出占比线圆和点色值
					stateText = "主力流出";
					break;
				case 4 : 
					ctx.strokeStyle = fallColor; //散户流出圆线色值
					ctx.fillStyle = fallColor; //散户流出占比线圆和点色值
					stateText = "散户流出";
					break;
				default : 
					return;
				}
				ctx.lineWidth = 30; // 圆周宽为30的占比图
				ctx.arc(isInteger(flowWidth * 0.5), isInteger(cenX), R - 30, 2 * Math.PI * assValue * 0.01, 2 * Math.PI * ((coreValue + assValue) * 0.01 - 0.005)); // 绘制圆
				ctx.stroke();
				var moveX = flowWidth * 0.5 + lineR * Math.cos(Math.PI * (coreValue + assValue * 2) * 0.01); // 占比线起点横坐标=圆心点的横坐标+(半径+10)[角度相同]的横坐标
				var moveY = cenX + lineR * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01); // 占比线起点纵坐标=圆心点的纵坐标+(半径+10)[角度相同]的纵坐标
				ctx.beginPath();
				ctx.lineWidth = lineWidth; // 设置线宽
				ctx.arc(isInteger(moveX), isInteger(moveY), 3, 0, 2 * Math.PI); // 占比线实心开始点
				ctx.arc(isInteger(moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01) + xCoor(coreValue * 0.5 + assValue)), isInteger(moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01)), 3, 0, 2 * Math.PI); // 占比线实心结束点
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(isInteger(moveX), isInteger(moveY)); // 占比线开始点
				ctx.lineTo(isInteger(moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01)), isInteger(moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01))); // 占比线转折点
				ctx.lineTo(isInteger(moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01) + xCoor(coreValue * 0.5 + assValue)), isInteger(moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01))); // 占比线结束点
				ctx.stroke();
				ctx.beginPath(); // 占比文字
				ctx.font = "26px Arial"; // 定义字体样式
				if(coreValue * 0.5 + assValue > 25 && coreValue * 0.5 + assValue < 75) { // 在圆图左侧
					ctx.fillText(coreValue + "%", moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01) + xCoor(coreValue * 0.5 + assValue), moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01) - 10);
					ctx.fillStyle = fontColor; // 默认字体样式
					ctx.fillText(stateText, moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01) + xCoor(coreValue * 0.5 + assValue), moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01) + 25);
				} else {
					ctx.fillText(coreValue + "%", moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01), moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01) - 10);
					ctx.fillStyle = fontColor; // 默认字体样式
					ctx.fillText(stateText, moveX + 30 * Math.cos(Math.PI * (coreValue + 2 * assValue) * 0.01), moveY + 30 * Math.sin(Math.PI * (coreValue + assValue * 2) * 0.01) + 25);
				}
				ctx.fillStyle = "#FFFFFF"; // 默认字体样式
				ctx.fillText("今日资金", isInteger(flowWidth * 0.5) - 52, isInteger(cenX) - 15);
				ctx.fillText("Capital Flows", isInteger(flowWidth * 0.5) - 78, isInteger(cenX) + 20);
				ctx.fillStyle = fontColor; // 默认字体样式
				ctx.font = "30px Arial"; // 定义字体样式
				ctx.fillText("最近5日主力增减仓", isInteger(flowWidth * 0.5) - 135, isInteger(cenX * 2) + 30);
			}
			ctx.beginPath();
			ctx.strokeStyle = "#7C9CC6"; // 5日增减仓图最外层圆线框色值
			ctx.lineWidth = 3;
			ctx.arc(isInteger(flowWidth * 0.5), isInteger(cenX), R, 0, 2 * Math.PI); // 绘制圆
			ctx.stroke();
			ctx.beginPath();
			ctx.strokeStyle = "#D0DEEC"; // 5日增减仓图从外到里第二层色值
			ctx.lineWidth = 10;
			ctx.arc(isInteger(flowWidth * 0.5), isInteger(cenX), R - 7, 0, 2 * Math.PI); // 绘制圆
			ctx.stroke();
			ctx.beginPath();
//			ctx.fillStyle = "#4784CA"; // 5日增减仓图最内层实心圆色值
			ctx.fillStyle = "#009be7"; // 5日增减仓图最内层实心圆色值
			ctx.arc(isInteger(flowWidth * 0.5), isInteger(cenX), 90, 0, 2 * Math.PI); // 绘制最后一个价格点的圆
			ctx.fill();
			if(data && data.length > 0) {
				if(data[data.length - 1][1] == 0 && data[data.length - 1][2] == 0) { // 总流入、总流出为0时删除最后的假数据
					data.length = data.length - 1; // 早上集合竞价未开盘时无资金流动，当日资金流为0 
				}
				var currentFlow = data[data.length - 1]; // 获取最后一条数据，为当日实时资金明细数据
				var mainOutflow = currentFlow[8] ? Math.round(currentFlow[8]) : 0; // 主力流出
				var mainInflow = currentFlow[9] ? Math.round(currentFlow[9]) : 0; // 主力流入
				var retailOutflow = currentFlow[10] ? Math.round(currentFlow[10]) : 0; // 散户流出
				var retailInflow = 100 - mainOutflow - mainInflow - retailOutflow; // 散户流入
				toDayFlowLocus(1, mainInflow, 0); // 今日资金流向明细圆图
				toDayFlowLocus(2, retailInflow, mainInflow); // 今日资金流向明细圆图
				toDayFlowLocus(3, mainOutflow, mainInflow + retailInflow); // 今日资金流向明细圆图
				toDayFlowLocus(4, retailOutflow, 100 - retailOutflow); // 今日资金流向明细圆图
			} else { // 无数据时画100%的主力流入
				toDayFlowLocus(1, 100, 0); // 今日资金流向明细圆图
			}
			ctx.beginPath(); // 下半部分 0.5-1的高度区域
			ctx.lineWidth = lineWidth; // 设置线宽
			ctx.strokeStyle = strokeColor;
			ctx.moveTo(40, isInteger(flowHeight * 0.7)); // 5日水平线开始点
			ctx.lineTo(flowWidth - 40, isInteger(flowHeight * 0.7)); // 5日水平线结束点
			ctx.stroke();
			if(data && data.length > 0) { // 存在5日历史资金流向
				var postWidth = (flowWidth - 100) / 9; // 柱子的宽度和间距
				var maxFlowValue = 0; // 五日资金净流向最大值
				var maxHeight = flowHeight * 0.2; // 最大高度值
				var len = (data.length - 5 > 0) ? data.length - 5 : 0;
				for (var i = data.length - 1; i >= len; i--) { // 循环确认最大值
					maxFlowValue = Math.max(maxFlowValue, Math.abs(data[i][3]));
				}
				var index = (data.length >= 5) ? data.length - 5 : 0;
				for (var i = 0 + index, j = 0; i < data.length; i++, j++) { // 5日资金明细柱状图
					var flowPostColor = data[i][3] >= 0 ? riseColor : fallColor;
					ctx.beginPath();
					ctx.fillStyle = flowPostColor; 
					ctx.fillRect(40 + 10 + postWidth * j * 2, flowHeight * 0.7, postWidth, isInteger(-data[i][3] * maxHeight / maxFlowValue));
					ctx.stroke();
					ctx.beginPath();
					ctx.font = "24px Arial"; // 定义字体样式
					ctx.fillText(data[i][3].toFixed(1), 40 + 10 + postWidth * j * 2, data[i][3] / Math.abs(data[i][3]) * 30 + flowHeight * 0.7);
					ctx.fillStyle = fontColor; // 默认字体样式
					ctx.fillText(numberConvertDate(1, data[i][0]), 40 + 10 + postWidth * j * 2, flowHeight * 0.9 + 30);
				}
				ctx.beginPath();
				ctx.lineWidth = lineWidth; // 红点
				ctx.fillStyle = riseColor; 
				ctx.arc(40, isInteger(flowHeight * 0.97 - 10), 5, 0, 2 * Math.PI);
				ctx.fill();
				ctx.beginPath();
				ctx.lineWidth = lineWidth; // 绿点
				ctx.fillStyle = fallColor; 
				ctx.arc(flowWidth * 0.5 - 60, isInteger(flowHeight * 0.97 - 10), 5, 0, 2 * Math.PI);
				ctx.fill();
				ctx.beginPath();
				ctx.font = "24px Arial"; // 定义字体样式
				ctx.fillStyle = fontColor; // 默认字体样式
				ctx.fillText("资金流入", 40 + 10, flowHeight * 0.97);
				ctx.fillText("资金流出", flowWidth * 0.5 - 50, flowHeight * 0.97);
				ctx.fillText("单位(万元)", flowWidth - 40 - 100, flowHeight * 0.97);
			}
			
		}
	}

	var canvas = {
			"frameFunc" : frameFunc, // canvas画图架子框架和行情图格子线方法
			"minLineFunc" : minLineFunc, // 画分时图方法
			"fiveLineFunc" : fiveLineFunc, // 画五日图方法
			"KLineFunc" : KLineFunc, // 画K线图方法
			"drawTargetKLineFunc" : drawTargetKLineFunc, // 画K线指标图方法
			"moveCruxFunc" : moveCruxFunc, // 移动十字架方法
			"flowsDetailFunc" : flowsDetailFunc, // 资金明细方法
			"clearCanvasFunc" : clearCanvasFunc, // 清理画布上面画的某只股票的行情图
			"lineFunc":lineFunc
	};
	module.exports = canvas;
});