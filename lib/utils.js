'use strict';

function flattenStack (stack) {
    return (stack || '').toString().replace(/\n/g,'');
}

module.exports = { flattenStack };
