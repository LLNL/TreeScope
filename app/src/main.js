/*
TreeScope, Version 1.0
Author Harsh Bhatia
LLNL-CODE-743437

Copyright (c) 2017, Lawrence Livermore National Security, LLC.
Produced at the Lawrence Livermore National Laboratory.
Written by Harsh Bhatia, hbhatia@llnl.gov. LLNL-CODE-743437.

All rights reserved.

This file is part of TreeScope. For details, see https://github.com/LLNL/TreeScope.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import Model from './model/model.js';
import UICounters from './modules/uiCounters.js';
import SummaryTime from './modules/summarytime.js';
import SummaryHisto from './modules/summaryhisto.js';
import FatTree from './modules/fattree.js';
import Jobs from './modules/jobs.js';
import Routing from './modules/routing.js';

import * as d3 from 'd3';

function setDebug(isDebug) {

  if (isDebug) {
    window.logger = {
      //log:      window.console.log.bind(window.console, '%s'),
      //error:    window.console.error.bind(window.console, '%s'),
      //info:     window.console.info.bind(window.console, '%s'),
      //warn:     window.console.warn.bind(window.console, '%s'),
      //critical: window.console.error.bind(window.console, '%s')
      log:      window.console.log.bind(window.console),
      error:    window.console.error.bind(window.console),
      info:     window.console.info.bind(window.console),
      warn:     window.console.warn.bind(window.console),
      critical: window.console.error.bind(window.console)
    };
  } else {

    var __no_op = function() {};
    window.logger = {
      log:    __no_op,
      error:  __no_op,
      warn:   __no_op,
      info:   __no_op,
      critical: __no_op
    }
  }
}
window.aerror = function() {
  return;
  let str = '$ '
  for (let i = 0; i < arguments.length; i++) {
    str = str + ' ' + arguments[i] + ' '
  }
  d3.select('#console')
    .classed('statusinfo', false)
    .classed('statuserror', true)
    .html(str)
}
window.astatus = function() {
  return;
  let str = '$ '
  for (let i = 0; i < arguments.length; i++) {
    str = str + ' ' + arguments[i] + ' '
  }
  d3.select('#console')
  .classed('statusinfo', true)
  .classed('statuserror', false)
  .html(str)
}
window.atooltip = function() {
  return;
  let str = '> '
  for (let i = 0; i < arguments.length; i++) {
    str = str + ' ' + arguments[i] + ' '
  }
  d3.select('#tooltip').text(str)
}


// --------------------------
setDebug(true);
init();

// --------------------------

function init() {

  logger.log('main.init()')

  // parse the request for data url
  let dataurl = undefined;
  let toks = window.location['search'].slice(1).split('&');

  for(let tok of toks){

    let t = tok.split('=')
    if(t[0] == 'data'){
      dataurl = t[1]
    }
  }

  if (dataurl == undefined) {

    logger.critical(' Data path not specified!')
  }
  else {
/*
d3.select('#testbutton')
 .on('click', function() {
 console.log('test clicked')
 window.open(this.href,'targetWindow',
              'toolbar=no, location=no, status=no, menubar=no, scrollbars=no, resizable=no, width=50, height=50');
               var picker = new ColorPicker("#00DB00");
 return false;
});
*/
/*
    var copi = cp.colorpicker();
    var colorData = cp.colorSystems.hsla;
    d3.select('.colorPicker svg')
      .datum(colorData)
      .call(copi)

    copi.dispatch.on('cpupdate', function(d) {
      console.log(cp.converters.dataToHslaString(d));
    });
*/

    window.astatus();
    window.atooltip();

    Model.init();
    UICounters.init();

    SummaryTime.init();
    SummaryHisto.init();

    FatTree.init();

    Jobs.init();
    Routing.init();

    Model.load(dataurl);
  }
}

// --------------------------
