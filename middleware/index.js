const fs = require('fs');
const path = require('path');

fs.readdirSync(__dirname).forEach(element => {
     let fileName = `${__dirname}/${element}/index.js`;
     if(fs.existsSync(fileName))
     {
        exports[element] = require(fileName);
     }
 });